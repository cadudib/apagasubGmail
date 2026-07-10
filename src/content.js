(() => {
  const CONTENT_VERSION = "1.53.0";
  if (globalThis.__apagaSubVersion === CONTENT_VERSION) return;
  if (globalThis.__apagaSubMessageListener) {
    chrome.runtime.onMessage.removeListener(globalThis.__apagaSubMessageListener);
  }
  globalThis.__apagaSubVersion = CONTENT_VERSION;

  const TEXT_MATCH = /(unsubscribe|unsubscribe here|cancelar inscrição|cancelar inscri[cç][aã]o|cancelar assinatura|cancelar sua assinatura|cancelar subscrição|cancelar a subscri[cç][aã]o|descadastrar|descadastre|sair da lista|remover inscrição|remover inscri[cç][aã]o|gerenciar preferências|gerenciar preferencias)/i;
  const scanSenderCache = new Set();
  let activeSpeedMode = "normal";
  let activeOperation = "";

  // Message routing.
  const messageListener = (message, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  };
  globalThis.__apagaSubMessageListener = messageListener;
  chrome.runtime.onMessage.addListener(messageListener);

  function debug(message) {
    if (activeSpeedMode === "fast" && /Verificando|Pulando remetente|Botões visíveis|Controles superiores/.test(message)) return;
    chrome.runtime.sendMessage({ type: "debugEvent", message }).catch(() => {});
  }

  function progress(message) {
    chrome.runtime.sendMessage({ type: "cleanupProgress", message }).catch(() => {});
    debug(message);
  }

  async function handleMessage(message) {
    const lockKey = operationLockKey(message);
    if (lockKey && activeOperation) return { ok: false, error: `Já existe uma ação em andamento no Gmail: ${activeOperation}.` };
    if (lockKey) activeOperation = lockKey;
    try {
      return await handleMessageUnlocked(message);
    } finally {
      if (lockKey) activeOperation = "";
    }
  }

  async function handleMessageUnlocked(message) {
    if (message?.type === "fillSearchGmail") return { ok: true, filled: fillSearchGmail(message.query || "") };
    if (message?.type === "runSearchGmail") {
      activeSpeedMode = message.speedMode || "normal";
      return { ok: true, searched: await runSearchGmail(message.query || "") };
    }
    if (message?.type === "getCurrentSenderGmail") return { ok: true, sender: bestVisibleSender() };
    if (message?.type === "diagnoseGmail") return { ok: true, diagnostic: diagnoseGmail() };
    if (message?.type === "scanVisibleGmail") return { ok: true, items: scanVisibleGmail() };
    if (message?.type === "scanPageGmail") {
      activeSpeedMode = message.speedMode || "normal";
      return { ok: true, items: await scanPageGmail(message.limit || 25, message.listOnly, activeSpeedMode) };
    }
    if (message?.type === "goNextPageGmail") return { ok: true, moved: goNextPageGmail() };
    if (message?.type === "unsubscribeVisibleGmail") return { ok: true, results: await unsubscribeItems(message.items || [], message.cleanupMode || "safe") };
    if (message?.type === "cleanupVisibleGmail") {
      activeSpeedMode = message.speedMode || "normal";
      return { ok: true, cleanup: await cleanupVisibleMessages(message.mode || "safe", message.sender || "", message.pageLimit, message.paginationOnly, message.confirmEachPage, activeSpeedMode) };
    }
    return { ok: false, error: "Ação desconhecida." };
  }

  function operationLockKey(message) {
    if (!message?.type) return "";
    if (["scanPageGmail", "unsubscribeVisibleGmail", "cleanupVisibleGmail", "runSearchGmail"].includes(message.type)) return message.type;
    return "";
  }

  function fillSearchGmail(query) {
    const searchBox = findSearchBox();
    if (!searchBox || !query.trim()) return false;
    searchBox.focus();
    searchBox.select?.();
    searchBox.value = query;
    searchBox.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: query }));
    searchBox.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function runSearchGmail(query) {
    const ready = await waitFor(() => Boolean(findSearchBox()), 3000);
    if (!ready || !fillSearchGmail(query)) return false;
    await wait(250);

    const searchBox = findSearchBox();
    if (searchBox) {
      for (const type of ["keydown", "keypress", "keyup"]) {
        searchBox.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      }
    }

    await waitForGmailIdle(speedTimeout(activeSpeedMode, 3000));
    await wait(speedDelay(activeSpeedMode, 450));
    if (searchLooksActive(query)) return true;

    const searchButton = findSearchButton(searchBox);
    if (searchButton) {
      activateElement(searchButton);
      await waitForGmailIdle(speedTimeout(activeSpeedMode, 4500));
      await wait(speedDelay(activeSpeedMode, 650));
    }

    return searchLooksActive(query);
  }

  function findSearchBox() {
    return document.querySelector('input[name="q"], textarea[name="q"], input[aria-label*="Search"], input[aria-label*="Pesquisar"], textarea[aria-label*="Search"], textarea[aria-label*="Pesquisar"]');
  }

  function diagnoseGmail() {
    const nextButton = findNextPageButton();
    return {
      searchBox: Boolean(findSearchBox()),
      rows: visibleMessageRows().length,
      selectBox: Boolean(findTopSelectBox()),
      trashButton: Boolean(findToolbarTrashButton()),
      activeSelection: selectionLooksActive(),
      nextPageButton: Boolean(nextButton),
      nextPageLabel: nextButton ? controlLabelText(nextButton) || elementSearchText(nextButton) : "",
      nextPageDisabled: nextButton ? nextButton.getAttribute("aria-disabled") === "true" : false,
      hash: location.hash
    };
  }

  function findSearchButton(searchBox) {
    const roots = [searchBox?.closest("form"), document].filter(Boolean);
    for (const root of roots) {
      const button = [...root.querySelectorAll("[aria-label], [data-tooltip], [role='button'], button")]
        .filter(isVisible)
        .find((element) => /^(search|pesquisar|pesquisar e-mail|search mail)$/i.test(elementSearchText(element)) || /search|pesquisar/i.test(elementSearchText(element)));
      if (button) return button;
    }
    return null;
  }

  function searchLooksActive(query) {
    const hash = decodeURIComponent(location.hash || "");
    return hash.includes("/search/") && hash.toLowerCase().includes(query.toLowerCase());
  }

  function scanVisibleGmail() {
    const rows = visibleMessageRows();
    if (rows.length) {
      return rows.slice(0, 50).map((row, index) => {
        const sender = senderFromRow(row);
        return {
          id: `row:${index}`,
          kind: "row",
          label: sender.name || sender.email || "Sem remetente",
          detail: sender.email || subjectFromRow(row.element) || "linha visível do Gmail",
          rowKey: row.key,
          source: "lista do Gmail",
          actionable: false
        };
      });
    }
    return linkItemsFromOpenMessage();
  }

  async function scanPageGmail(limit, listOnly = false, speedMode = "normal") {
    const targets = visibleMessageRows()
      .slice(0, limit)
      .map((row) => ({ rowKey: row.key, sender: senderFromRow(row) }))
      .filter((item) => item.sender.email || item.sender.name)
      .filter((item) => {
        const key = (item.sender.email || item.sender.name || "").toLowerCase();
        if (!key || !scanSenderCache.has(key)) return true;
        debug(`Pulando remetente já verificado nesta sessão: ${key}`);
        return false;
      });
    const results = [];
    const seen = new Set();
    debug(`Varredura iniciada: ${targets.length}/${limit} e-mails visíveis.`);

    for (const [index, target] of targets.entries()) {
      debug(`Verificando ${index + 1}/${targets.length}: ${target.sender.name || target.sender.email}`);
      const row = findRowByKey(target.rowKey);
      if (!row) {
        debug(`Linha não encontrada: ${target.sender.name || target.sender.email}`);
        continue;
      }

      const rowButton = await findRowUnsubscribeButton(row.element);
      if (rowButton) {
        const key = `row-button:${target.rowKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `rowButton:${results.length}`,
            kind: "rowButton",
            label: target.sender.name || target.sender.email,
            detail: target.sender.email || subjectFromRow(row.element) || "botão na lista do Gmail",
            rowKey: target.rowKey,
            selectorText: elementSearchText(rowButton),
            source: "botão lista",
            actionable: true
          });
          debug(`Encontrado na lista: ${target.sender.name || target.sender.email}`);
        }
        continue;
      }

      if (listOnly) {
        const senderCacheKey = (target.sender.email || target.sender.name || "").toLowerCase();
        results.push({
          id: `missing:${results.length}`,
          kind: "missing",
          label: target.sender.name || target.sender.email,
          detail: target.sender.email || "não aberto no modo lista",
          rowKey: target.rowKey,
          source: "lista apenas",
          actionable: false
        });
        if (senderCacheKey) scanSenderCache.add(senderCacheKey);
        continue;
      }

      debug(`Abrindo e-mail: ${target.sender.name || target.sender.email}`);
      openMessageRow(row.element);
      await wait(speedDelay(speedMode, 1800));
      await waitForMessageView();
      await waitFor(() => findUnsubscribeElements().length > 0, speedTimeout(speedMode, 3000));

      const links = linkItemsFromOpenMessage(target.sender, target.rowKey);
      if (links.length) {
        for (const link of links) {
          const key = link.href || `message-button:${target.rowKey}:${link.selectorText}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({ ...link, id: `deep:${results.length}`, source: link.href ? "link externo" : "botão Gmail" });
          debug(`Encontrado no e-mail: ${target.sender.name || target.sender.email} (${link.href ? "link" : "botão"})`);
        }
      } else {
        const key = `missing:${target.rowKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `missing:${results.length}`,
            kind: "missing",
            label: target.sender.name || target.sender.email,
            detail: target.sender.email || "sem descadastro visível",
            rowKey: target.rowKey,
            source: "varredura",
            actionable: false
          });
          debug(`Não achou descadastro: ${target.sender.name || target.sender.email}`);
        }
      }

      const returned = await returnToList();
      debug(returned ? "Voltou para a lista." : "Não confirmou retorno para a lista.");
    }

    debug(`Varredura finalizada: ${results.filter((item) => item.actionable).length} pronto(s), ${results.filter((item) => !item.actionable).length} sem link.`);
    return results;
  }

  async function unsubscribeItems(items, cleanupMode) {
    cleanupMode = normalizeCleanupMode(cleanupMode);
    const results = [];
    debug(`Descadastro iniciado: ${items.length} item(ns). Limpeza: ${cleanupMode}.`);
    for (const item of items) {
      debug(`Processando saída: ${item.label || item.detail || item.id}`);
      const result = await processUnsubscribeItem(item);
      result.senderEmail = senderEmailFromItem(item);
      result.cleanupMode = cleanupMode;
      result.cleanup = {
        attempted: false,
        sender: result.senderEmail,
        mode: cleanupMode,
        message: result.urlToOpen ? "Link externo aberto; limpeza não executada automaticamente." : "Limpeza pendente no popup."
      };
      results.push(result);
      await wait(1500);
    }
    debug("Descadastro finalizado.");
    return results;
  }

  function normalizeCleanupMode(mode) {
    return ["safe", "semi", "auto", "off", "simulate"].includes(mode) ? mode : "safe";
  }

  async function processUnsubscribeItem(item) {
    if (item.kind === "rowButton") {
      return clickRowUnsubscribe(item);
    }
    if (item.kind === "link" && item.href) {
      return { id: item.id, senderName: item.label, ok: true, urlToOpen: item.href, message: "Link de descadastro aberto para confirmação." };
    }
    if (item.kind === "link") {
      return clickVisibleUnsubscribe(item);
    }
    return { id: item.id, senderName: item.label, ok: false, message: "Use Varrer página para procurar o botão de descadastro." };
  }

  async function cleanupVisibleMessages(mode, sender, pageLimit, paginationOnly = false, confirmEachPage = false, speedMode = "normal") {
    mode = normalizeCleanupMode(mode);
    if (!sender) {
      debug("Limpeza ignorada: remetente sem e-mail claro.");
      return { attempted: false, sender: "", mode, message: "Remetente sem e-mail claro." };
    }

    debug(`Limpando mensagens visíveis (${mode}): ${sender}`);
    const listReady = await waitForListOrEmpty(speedTimeout(speedMode, 10000));
    if (!listReady) {
      debug(`Limpeza falhou: lista não carregou para ${sender}.`);
      return { attempted: true, sender, mode, selected: false, deleted: false, pagesDeleted: 0, message: "A busca do remetente não carregou a lista a tempo." };
    }
    if (visibleMessageRows().length === 0 && searchLooksEmpty()) {
      progress(`Nenhuma mensagem encontrada para ${sender}; pulando alvo.`);
      return { attempted: true, sender, mode, selected: false, deleted: false, pagesDeleted: 0, messagesDeleted: 0, pagesSkipped: 1, message: "Nenhuma mensagem encontrada para este remetente." };
    }

    if (mode === "safe") {
      debug(`Modo seguro: filtro aplicado para ${sender}.`);
      return { attempted: true, sender, mode, message: "Filtro por remetente aplicado." };
    }

    if (mode === "simulate") {
      const maxPages = normalizePageLimit(pageLimit);
      let pagesSeen = 0;
      let visibleCount = 0;
      let hasNextPage = false;
      const pageReport = [];

      progress(`Teste de paginação: limite ${maxPages === 100 ? "até acabar" : `${maxPages} página(s)`}.`);
      for (let page = 1; page <= maxPages; page += 1) {
        const count = visibleMessageRows().length;
        pagesSeen += 1;
        visibleCount += count;
        hasNextPage = Boolean(findNextPageButton());
        pageReport.push({ page, count, hasNextPage });
        progress(`Página ${page}: ${count} mensagem(ns); próxima página: ${hasNextPage ? "sim" : "não"}.`);
        if (!hasNextPage) break;
        if (!paginationOnly && page >= maxPages) break;
        if (page >= maxPages) break;
        const moved = goNextPageGmail();
        progress(moved ? `Página ${page}: avançou para próxima.` : `Página ${page}: não conseguiu avançar.`);
        if (!moved) {
          hasNextPage = false;
          break;
        }
        const nextReady = await waitForListOrEmpty(speedTimeout(speedMode, 8000));
        if (!nextReady) {
          hasNextPage = false;
          progress(`Página ${page + 1}: não carregou a tempo.`);
          break;
        }
        await waitForGmailIdle(speedTimeout(speedMode, 2500));
        await wait(speedDelay(speedMode, 600));
      }

      const message = `Simulação: ${visibleCount} mensagem(ns) em ${pagesSeen} página(s); próxima página final: ${hasNextPage ? "sim" : "não"}.`;
      progress(message);
      return { attempted: true, sender, mode, simulated: true, paginationOnly, visibleCount, pagesSeen, hasNextPage, pageReport, pagesDeleted: 0, deleted: false, message };
    }

    const selected = await selectVisibleMessages();
    debug(selected ? "Mensagens visíveis selecionadas." : "Não consegui selecionar mensagens visíveis.");
    if (selected) await wait(1200);

    if (mode === "semi") {
      return {
        attempted: true,
        sender,
        mode,
        selected,
        message: selected ? "Mensagens visíveis selecionadas." : "Não consegui selecionar mensagens visíveis."
      };
    }

    if (!selected) {
      return {
        attempted: true,
        sender,
        mode,
        selected,
        deleted: false,
        pagesDeleted: 0,
        message: "Não consegui selecionar mensagens visíveis."
      };
    }

    let deleted = false;
    let pagesDeleted = 0;
    let messagesDeleted = 0;
    let pagesSkipped = 0;
    let stoppedBecauseListDidNotChange = false;
    let stopped = false;
    let stopReason = "";
    const pageReport = [];
    const maxPages = normalizePageLimit(pageLimit);
    let adaptivePause = speedDelay(speedMode, 2500);
    progress(`Limite desta limpeza: ${maxPages === 100 ? "até acabar" : `${maxPages} página(s)`}.`);

    for (let page = 1; page <= maxPages; page += 1) {
      if (await shouldStopCleanup()) {
        stopped = true;
        stopReason = "parada solicitada";
        progress("Limpeza interrompida antes da próxima página.");
        break;
      }
      const beforeKey = visibleRowsSnapshot();
      const visibleBeforeSelect = visibleMessageRows().length;
      if (visibleBeforeSelect === 0) {
        pagesSkipped += 1;
        progress(`Página ${page}: vazia, procurando próxima.`);
        const movedFromEmpty = goNextPageGmail();
        if (!movedFromEmpty) break;
        const emptyNextReady = await waitForListOrEmpty(speedTimeout(speedMode, 8000));
        if (!emptyNextReady) break;
        await waitForGmailIdle(speedTimeout(speedMode, 2500));
        continue;
      }
      const pageSelected = page === 1 ? true : await selectVisibleMessages();
      progress(pageSelected ? `Página ${page}/${maxPages}: ${visibleBeforeSelect} mensagem(ns) selecionada(s).` : `Página ${page}/${maxPages}: não consegui selecionar mensagens.`);
      if (!pageSelected) break;
      await wait(speedDelay(speedMode, 1000));

      const visibleCount = visibleMessageRows().length;
      if (confirmEachPage && !confirm(`Apaga Sub: enviar para a lixeira a página ${page} com ${visibleCount} mensagem(ns)?`)) {
        stopped = true;
        stopReason = "usuário cancelou confirmação da página";
        progress(`Página ${page}: cancelada pelo usuário.`);
        break;
      }

      const pageDeleted = await waitFor(() => clickTrashButton(), speedTimeout(speedMode, 7000));
      progress(pageDeleted ? `Página ${page}: cliquei na lixeira.` : `Página ${page}: não encontrei a lixeira.`);
      if (!pageDeleted) break;

      deleted = true;
      pagesDeleted += 1;
      messagesDeleted += visibleCount;
      pageReport.push({ page, count: visibleCount, deleted: true });
      progress(`Página ${page} enviada para a lixeira. Total: ${pagesDeleted} página(s), ${messagesDeleted} mensagem(ns).`);
      await waitForGmailIdle(speedTimeout(speedMode, adaptivePause));
      await wait(adaptivePause);

      const changed = speedMode === "fast" && visibleMessageRows().length === 0
        ? true
        : await waitFor(() => visibleRowsSnapshot() !== beforeKey, speedTimeout(speedMode, 7000));
      adaptivePause = changed ? Math.max(300, Math.round(adaptivePause * 0.8)) : Math.min(4000, Math.round(adaptivePause * 1.35));
      if (!changed && visibleMessageRows().length > 0) {
        stoppedBecauseListDidNotChange = true;
        stopReason = "lista não mudou após clique na lixeira";
        debug("Limpeza interrompida: cliquei na lixeira, mas a lista visível não mudou.");
        break;
      }

      if (visibleMessageRows().length > 0) {
        progress(`Página ${page}: ainda há mensagens visíveis; repetindo seleção nesta página.`);
        continue;
      }

      progress(`Página ${page}: verificando próxima página.`);
      const moved = goNextPageGmail();
      progress(moved ? "Avançando para próxima página do remetente." : "Fim das páginas para este remetente.");
      if (!moved) break;

      const nextReady = await waitForListView(speedTimeout(speedMode, 8000));
      if (!nextReady) break;
      await waitForGmailIdle(speedTimeout(speedMode, 2500));
      await wait(speedDelay(speedMode, 700));
    }

    return {
      attempted: true,
      sender,
      mode,
      selected,
      deleted,
      pagesDeleted,
      messagesDeleted,
      pagesSkipped,
      stopped,
      stopReason,
      pageReport,
      message: deleted
        ? stopped
          ? `${pagesDeleted} página(s) enviada(s) para a lixeira; parada solicitada.`
          : stoppedBecauseListDidNotChange
          ? `${pagesDeleted} página(s) enviada(s) para a lixeira; parei porque a lista não mudou depois do clique.`
          : pagesDeleted >= maxPages
          ? `${pagesDeleted} página(s) enviada(s) para a lixeira; limite atingido.`
          : `${pagesDeleted} página(s) e ${messagesDeleted} mensagem(ns) enviada(s) para a lixeira.`
        : "Não consegui enviar mensagens para a lixeira."
    };
  }

  function normalizePageLimit(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 20;
    if (numeric === 0) return 100;
    return Math.max(1, Math.min(100, Math.floor(numeric)));
  }

  function senderEmailFromItem(item) {
    const value = `${item.detail || ""} ${item.label || ""}`;
    return value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "";
  }

  async function selectVisibleMessages() {
    const selectBox = findTopSelectBox();
    if (!selectBox) return false;
    activateElement(selectBox);
    await wait(speedDelay(activeSpeedMode, 700));

    const choseAll = await chooseAllFromSelectionMenu();
    if (choseAll) {
      debug("Opção Todos selecionada no menu do Gmail.");
      await wait(speedDelay(activeSpeedMode, 1800));
    }

    await waitFor(() => selectionLooksActive() || Boolean(findToolbarTrashButton()), speedTimeout(activeSpeedMode, 2500));
    return Boolean(findToolbarTrashButton()) || choseAll;
  }

  function findTopSelectBox() {
    const firstRow = visibleMessageRows()[0]?.element;
    const rowTop = firstRow?.getBoundingClientRect().top || 260;
    return [...document.querySelectorAll('[aria-label="Select"], [aria-label="Selecionar"], [data-tooltip="Select"], [data-tooltip="Selecionar"], div[role="checkbox"][aria-checked="false"]')]
      .filter(isVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top < rowTop && rect.width <= 80 && rect.height <= 80;
      })[0] || null;
  }

  function visibleRowsSnapshot() {
    return visibleMessageRows().map((row) => row.key).join("|");
  }

  async function shouldStopCleanup() {
    try {
      const { cleanupStopRequested } = await chrome.storage.local.get({ cleanupStopRequested: false });
      return Boolean(cleanupStopRequested);
    } catch {
      return false;
    }
  }

  function clickTrashButton() {
    const trashButton = findToolbarTrashButton();
    if (!trashButton) {
      debugToolbarControls();
      return false;
    }
    if (!selectionLooksActive()) {
      debug("Não cliquei na lixeira: não detectei seleção ativa no Gmail.");
      return false;
    }
    debug(`Clicando lixeira: ${controlLabelText(trashButton) || elementSearchText(trashButton) || trashButton.getAttribute("act") || "controle sem rótulo"}`);
    activateElement(trashButton);
    return true;
  }

  function findToolbarTrashButton() {
    const direct = [
      ...document.querySelectorAll(
        'div[act="10"], [act="10"], [data-tooltip="Delete"], [data-tooltip="Excluir"], [data-tooltip*="Move to trash"], [data-tooltip*="Mover para a lixeira"], [aria-label="Delete"], [aria-label="Excluir"], [aria-label*="Move to trash"], [aria-label*="Mover para a lixeira"]'
      )
    ]
      .filter(isVisible)
      .filter(isToolbarControl)[0];
    if (direct) return direct;

    return [...document.querySelectorAll("[aria-label], [data-tooltip], [role='button'], div[role='button'], [act]")]
      .filter(isVisible)
      .filter(isToolbarControl)
      .find((element) => {
        const text = controlLabelText(element);
        return /^(delete|excluir|mover para a lixeira|mover para lixeira|move to trash)$/i.test(text) || /delete|excluir|mover para a lixeira|mover para lixeira|move to trash/i.test(text);
      }) || null;
  }

  function debugToolbarControls() {
    const labels = [...document.querySelectorAll("[aria-label], [data-tooltip], [role='button'], div[role='button'], [act]")]
      .filter(isVisible)
      .filter(isToolbarControl)
      .map((element) => controlLabelText(element) || elementSearchText(element) || `act:${element.getAttribute("act") || ""}`)
      .filter(Boolean)
      .slice(0, 12);
    debug(labels.length ? `Controles superiores visíveis: ${labels.join(" | ")}` : "Nenhum controle superior visível para excluir.");
  }

  async function chooseAllFromSelectionMenu() {
    const found = await waitFor(() => visibleSelectionAllItems().length > 0, 1500);
    if (!found) return false;
    const item = visibleSelectionAllItems()[0];
    activateElement(item);
    return true;
  }

  function visibleSelectionAllItems() {
    return [...document.querySelectorAll("[role='menuitem'], [role='option'], .J-N, .goog-menuitem, [tabindex]")]
      .filter(isVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width > 360 || rect.height > 80) return false;
        const text = elementSearchText(element);
        return /^(todos|all)$/i.test(text) || /^selecionar todos$/i.test(text);
      });
  }

  function selectionLooksActive() {
    const firstRowTop = visibleMessageRows()[0]?.element.getBoundingClientRect().top || 260;
    return [...document.querySelectorAll('[role="checkbox"][aria-checked="true"], [role="checkbox"][aria-checked="mixed"], input[type="checkbox"]:checked')]
      .filter(isVisible)
      .some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= firstRowTop + 80 || Boolean(element.closest("tr[role='row']"));
      });
  }

  function controlLabelText(element) {
    return cleanText([element.getAttribute("aria-label"), element.getAttribute("title"), element.getAttribute("data-tooltip"), element.getAttribute("data-tooltip-content")].filter(Boolean).join(" "));
  }

  function isToolbarControl(element) {
    if (element.closest('a[href*="#trash"], a[href*="#bin"], a[href*="#inbox"], a[href*="#sent"], a[href*="#drafts"]')) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width > 120 || rect.height > 80) return false;
    const firstRowTop = visibleMessageRows()[0]?.element.getBoundingClientRect().top || 260;
    return rect.top < firstRowTop;
  }

  function linkItemsFromOpenMessage(senderOverride, rowKey = "") {
    const sender = senderOverride || currentSender();
    const items = [];
    const seen = new Set();
    for (const element of findUnsubscribeElements()) {
      const href = normalizeHref(element.getAttribute("href"));
      const text = elementSearchText(element) || href || "Cancelar inscrição";
      const key = href || text;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `link:${items.length}`,
        kind: "link",
        label: sender.name || text,
        detail: sender.email || text,
        href,
        rowKey,
        selectorText: text,
        source: href ? "link externo" : "botão Gmail",
        actionable: true
      });
    }
    return items;
  }

  async function clickRowUnsubscribe(item) {
    const row = await ensureRowVisible(item.rowKey);
    if (!row) {
      debug(`Falha: linha não encontrada para ${item.label}.`);
      return { id: item.id, senderName: item.label, ok: false, message: "Não achei mais a linha desse e-mail." };
    }
    const button = await findRowUnsubscribeButton(row.element);
    if (!button) {
      debug(`Falha: botão da lista não apareceu para ${item.label}.`);
      return { id: item.id, senderName: item.label, ok: false, message: "O botão da lista não apareceu no hover." };
    }
    debug(`Clicando botão da lista: ${elementSearchText(button)}`);
    activateElement(button);
    const confirmed = await clickVisibleConfirmation(5000);
    debug(confirmed ? "Confirmação automática clicada." : "Confirmação automática não encontrada.");
    return { id: item.id, senderName: item.label, ok: true, message: confirmed ? "Botão da lista acionado e confirmação clicada." : "Botão da lista acionado. Confirme manualmente se o Gmail pedir." };
  }

  async function clickVisibleUnsubscribe(item) {
    if (item.rowKey) {
      const row = await ensureRowVisible(item.rowKey);
      if (row) {
        openMessageRow(row.element);
        await wait(1800);
        await waitForMessageView();
      }
      await wait(1500);
    }
    await waitFor(() => findUnsubscribeElements().length > 0, 4000);
    const element = findUnsubscribeElements().find((candidate) => elementSearchText(candidate) === item.selectorText) || findUnsubscribeElements()[0];
    if (!element) {
      debug(`Falha: botão interno não visível para ${item.label}.`);
      return { id: item.id, senderName: item.label, ok: false, message: "O botão de cancelar inscrição não está visível agora." };
    }
    debug(`Clicando botão interno: ${elementSearchText(element)}`);
    activateElement(element);
    const confirmed = await clickVisibleConfirmation(5000);
    debug(confirmed ? "Confirmação automática clicada." : "Confirmação automática não encontrada.");
    return { id: item.id, senderName: item.label, ok: true, message: confirmed ? "Botão acionado e confirmação do Gmail clicada." : "Botão acionado. Se aparecer uma confirmação no Gmail, confirme manualmente." };
  }

  async function findRowUnsubscribeButton(rowElement) {
    hoverElement(rowElement);
    await wait(700);
    const rowRect = rowElement.getBoundingClientRect();
    return findUnsubscribeElements().find((element) => {
      const rect = element.getBoundingClientRect();
      const overlapsY = rect.top <= rowRect.bottom + 10 && rect.bottom >= rowRect.top - 10;
      const nearRight = rect.left >= rowRect.left + rowRect.width * 0.25;
      return overlapsY && nearRight;
    }) || null;
  }

  async function ensureRowVisible(rowKey) {
    let row = findRowByKey(rowKey);
    if (row) return row;
      await returnToList();
    return findRowByKey(rowKey) || null;
  }

  function visibleMessageRows() {
    const rawRows = [...document.querySelectorAll("tr[role='row']")]
      .map((row) => row.closest("tr[role='row']"))
      .filter(Boolean);
    const uniqueRows = [...new Set(rawRows)];
    return uniqueRows
      .filter((row) => isVisible(row) && row.querySelector("[email], [data-hovercard-id], .yW, .bA4"))
      .map((element, index) => {
        const sender = senderFromRow({ element });
        return { element, index, key: rowKeyFor(element, sender, index) };
      });
  }

  function findRowByKey(key) {
    return visibleMessageRows().find((row) => row.key === key);
  }

  function rowKeyFor(element, sender, index) {
    return `${index}:${sender.email || sender.name}:${subjectFromRow(element)}`;
  }

  function subjectFromRow(element) {
    return cleanText(element.querySelector(".bog")?.textContent || "") || cleanText(element.textContent || "").slice(0, 180);
  }

  function senderFromRow(row) {
    const senderEl =
      row.element.querySelector("[email]") ||
      row.element.querySelector("[data-hovercard-id]") ||
      row.element.querySelector(".yW span[email]") ||
      row.element.querySelector(".yW span") ||
      row.element.querySelector(".bA4 span");
    return {
      name: cleanText(senderEl?.textContent || senderEl?.getAttribute("name") || senderEl?.getAttribute("aria-label") || ""),
      email: senderEl?.getAttribute("email") || senderEl?.getAttribute("data-hovercard-id") || ""
    };
  }

  function currentSender() {
    const senderEl = document.querySelector("[role='main'] [email]") || document.querySelector("[role='main'] [data-hovercard-id]");
    return {
      name: cleanText(senderEl?.textContent || senderEl?.getAttribute("name") || ""),
      email: senderEl?.getAttribute("email") || senderEl?.getAttribute("data-hovercard-id") || ""
    };
  }

  function bestVisibleSender() {
    const sender = currentSender();
    if (sender.email || sender.name) return sender;
    const firstRow = visibleMessageRows()[0];
    return firstRow ? senderFromRow(firstRow) : { name: "", email: "" };
  }

  function findUnsubscribeElements() {
    const matches = [];
    const seen = new Set();
    const candidates = [...document.querySelectorAll("a, button, [role='button'], [data-tooltip], [aria-label], span, div")];
    for (const element of candidates) {
      if (!isVisible(element)) continue;
      const href = element.getAttribute("href") || "";
      const text = elementSearchText(element);
      if (!TEXT_MATCH.test(text) && !/unsubscribe|optout|opt-out/i.test(href)) continue;
      const clickable = closestClickable(element);
      if (!clickable || seen.has(clickable)) continue;
      seen.add(clickable);
      matches.push(clickable);
    }
    return matches.sort((a, b) => scoreUnsubscribeElement(b) - scoreUnsubscribeElement(a));
  }

  function closestClickable(element) {
    return element.closest("a[href]") || element.closest("button") || element.closest("[role='button']") || element.closest("[jsaction]") || element.closest("[tabindex]") || element;
  }

  function scoreUnsubscribeElement(element) {
    const text = elementSearchText(element);
    let score = 0;
    if (/^cancelar inscri[cç][aã]o$/i.test(text)) score += 120;
    if (/cancelar inscri[cç][aã]o/i.test(text)) score += 100;
    if (/unsubscribe/i.test(text)) score += 70;
    if (element.closest("[role='main']")) score += 10;
    if (element.getAttribute("href")) score += 5;
    return score;
  }

  function elementSearchText(element) {
    return cleanText([element.textContent, element.getAttribute("aria-label"), element.getAttribute("title"), element.getAttribute("data-tooltip"), element.getAttribute("data-tooltip-content")].filter(Boolean).join(" "));
  }

  function hoverElement(element) {
    element.scrollIntoView({ block: "center", inline: "center" });
    for (const type of ["mouseover", "mouseenter", "mousemove"]) {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function activateElement(element) {
    element.scrollIntoView({ block: "center", inline: "center" });
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX, clientY }));
    }
    element.click();
  }

  async function clickVisibleConfirmation(timeout) {
    const found = await waitFor(() => confirmationButtons().length > 0, timeout);
    debugVisibleDialogButtons();
    if (!found) return false;
    const button = confirmationButtons()[0];
    debug(`Clicando confirmação: ${elementSearchText(button)}`);
    activateElement(button);
    await wait(1000);
    return true;
  }

  function confirmationButtons() {
    const dialogs = [...document.querySelectorAll('[role="dialog"], .Kj-JD, .J-J5-Ji, [aria-modal="true"]')].filter(isVisible);
    const roots = dialogs.length ? dialogs : [document];
    const candidates = roots.flatMap((root) => [...root.querySelectorAll("button, a[href], [role='button'], [jsaction][tabindex], [tabindex='0']")]);
    const seen = new Set();
    return candidates
      .filter(isVisible)
      .map((element) => closestClickable(element))
      .filter((element) => {
        if (!element || seen.has(element) || !isVisible(element) || !isLikelyButtonControl(element)) return false;
        seen.add(element);
        return true;
      })
      .filter((element) => /^(ok|sim|yes|confirmar|confirm|unsubscribe|cancelar inscrição|cancelar inscri[cç][aã]o|cancelar assinatura|cancelar subscrição|cancelar a subscri[cç][aã]o)$/i.test(elementSearchText(element)))
      .sort((a, b) => confirmationScore(b) - confirmationScore(a));
  }

  function confirmationScore(element) {
    const text = elementSearchText(element);
    let score = 0;
    if (element.closest('[role="dialog"], .J-J5-Ji, .Kj-JD')) score += 100;
    if (/cancelar inscri[cç][aã]o|unsubscribe/i.test(text)) score += 50;
    if (/confirmar|confirm/i.test(text)) score += 30;
    return score;
  }

  function isLikelyButtonControl(element) {
    if (element.getAttribute("role") === "dialog") return false;
    const rect = element.getBoundingClientRect();
    const text = elementSearchText(element);
    if (rect.width > 360 || rect.height > 96) return false;
    if (text.length > 80) return false;
    return (
      element.tagName === "BUTTON" ||
      element.tagName === "A" ||
      element.getAttribute("role") === "button" ||
      element.hasAttribute("jsaction") ||
      element.tabIndex >= 0
    );
  }

  function debugVisibleDialogButtons() {
    const dialogs = [...document.querySelectorAll('[role="dialog"], .Kj-JD, .J-J5-Ji')].filter(isVisible);
    const roots = dialogs.length ? dialogs : [document];
    const labels = roots
      .flatMap((root) => [...root.querySelectorAll("button, a[href], [role='button'], [jsaction][tabindex], [tabindex='0']")])
      .filter(isVisible)
      .filter(isLikelyButtonControl)
      .map(elementSearchText)
      .filter(Boolean)
      .slice(0, 10);
    debug(labels.length ? `Botões visíveis no modal: ${labels.join(" | ")}` : "Nenhum botão visível no modal.");
  }

  function goBackToList() {
    const backButton = document.querySelector('[aria-label="Back to Inbox"], [aria-label="Voltar para a Caixa de entrada"], [aria-label="Voltar"]');
    if (backButton) {
      activateElement(backButton);
      return;
    }
    history.back();
  }

  async function returnToList() {
    if (visibleMessageRows().length > 0) return true;

    goBackToList();
    if (await waitForListView(4500)) return true;

    history.back();
    if (await waitForListView(4500)) return true;

    const inboxLink = document.querySelector('a[href*="#inbox"], a[title*="Inbox"], a[title*="Caixa"]');
    if (inboxLink) {
      activateElement(inboxLink);
      return waitForListView(4500);
    }

    return false;
  }

  function goNextPageGmail() {
    const safeNextButton = findNextPageButton();
    if (!safeNextButton) return false;
    activateElement(safeNextButton);
    return true;
  }

  function findNextPageButton() {
    return [...document.querySelectorAll("[aria-label], [data-tooltip], [role='button'], div[role='button']")]
      .filter(isVisible)
      .filter((element) => element.getAttribute("aria-disabled") !== "true" && !element.classList.contains("T-I-JE"))
      .filter(isToolbarControl)
      .find((element) => {
        const text = controlLabelText(element) || elementSearchText(element);
        return /^(older|mais antigas|próxima|proxima)$/i.test(text) || /next page|página seguinte|pagina seguinte|older|mais antigas/i.test(text);
      }) || null;
  }

  function openMessageRow(rowElement) {
    const subjectCell = rowElement.querySelector(".bog") || rowElement.querySelector("[role='link']") || rowElement.querySelector("td:nth-child(5)") || rowElement;
    activateElement(subjectCell);
  }

  async function waitForMessageView() {
    await waitFor(() => document.querySelector(".adn, [data-message-id], div[role='main'] h2") || findUnsubscribeElements().length > 0, 6500);
  }

  async function waitForListView(timeout = 5000) {
    return waitFor(async () => {
      if (isGmailLoading()) return false;
      return visibleMessageRows().length > 0;
    }, timeout);
  }

  async function waitForListOrEmpty(timeout = 5000) {
    return waitFor(async () => {
      if (isGmailLoading()) return false;
      return visibleMessageRows().length > 0 || searchLooksEmpty();
    }, timeout);
  }

  async function waitForGmailIdle(timeout = 3000, stableMs = 350) {
    const started = Date.now();
    let stableSince = 0;
    while (Date.now() - started < timeout) {
      if (!isGmailLoading()) {
        stableSince ||= Date.now();
        if (Date.now() - stableSince >= stableMs) return true;
      } else {
        stableSince = 0;
      }
      await wait(120);
    }
    return false;
  }

  function isGmailLoading() {
    const candidates = [...document.querySelectorAll('[role="progressbar"], [aria-busy="true"], .vO, .aDP, .loading')];
    if (candidates.some(isVisible)) return true;
    const text = cleanText(document.body?.innerText || "").slice(0, 3000);
    return /\b(loading|carregando|atualizando)\b/i.test(text) && !visibleMessageRows().length;
  }

  function searchLooksEmpty() {
    const text = cleanText(document.body?.innerText || "");
    return /no messages matched your search|nenhuma mensagem corresponde|nenhum resultado encontrado|não encontrou nenhum resultado/i.test(text);
  }

  function normalizeHref(href) {
    if (!href || href.startsWith("#")) return "";
    try {
      return new URL(href, location.href).href;
    } catch {
      return "";
    }
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function cleanText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function speedDelay(mode, normalMs) {
    if (mode === "turbo") return Math.max(120, Math.round(normalMs * 0.28));
    if (mode === "fast") return Math.max(200, Math.round(normalMs * 0.45));
    if (mode === "safe") return Math.round(normalMs * 1.35);
    return normalMs;
  }

  function speedTimeout(mode, normalMs) {
    if (mode === "turbo") return Math.max(900, Math.round(normalMs * 0.45));
    if (mode === "fast") return Math.max(1200, Math.round(normalMs * 0.6));
    if (mode === "safe") return Math.round(normalMs * 1.35);
    return normalMs;
  }

  async function waitFor(predicate, timeout) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await predicate()) return true;
      await wait(250);
    }
    return false;
  }
})();
