(() => {
  if (globalThis.__apagaSubVersion === "1.25.0") return;
  globalThis.__apagaSubVersion = "1.25.0";

  const TEXT_MATCH = /(unsubscribe|unsubscribe here|cancelar inscrição|cancelar inscri[cç][aã]o|cancelar assinatura|cancelar sua assinatura|cancelar subscrição|cancelar a subscri[cç][aã]o|descadastrar|descadastre|sair da lista|remover inscrição|remover inscri[cç][aã]o|gerenciar preferências|gerenciar preferencias)/i;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  function debug(message) {
    chrome.runtime.sendMessage({ type: "debugEvent", message }).catch(() => {});
  }

  async function handleMessage(message) {
    if (message?.type === "fillSearchGmail") return { ok: true, filled: fillSearchGmail(message.query || "") };
    if (message?.type === "getCurrentSenderGmail") return { ok: true, sender: bestVisibleSender() };
    if (message?.type === "scanVisibleGmail") return { ok: true, items: scanVisibleGmail() };
    if (message?.type === "scanPageGmail") return { ok: true, items: await scanPageGmail(message.limit || 25) };
    if (message?.type === "goNextPageGmail") return { ok: true, moved: goNextPageGmail() };
    if (message?.type === "unsubscribeVisibleGmail") return { ok: true, results: await unsubscribeItems(message.items || [], message.cleanupMode || "safe") };
    return { ok: false, error: "Ação desconhecida." };
  }

  function fillSearchGmail(query) {
    const searchBox = document.querySelector('input[name="q"], textarea[name="q"], input[aria-label*="Search"], input[aria-label*="Pesquisar"], textarea[aria-label*="Search"], textarea[aria-label*="Pesquisar"]');
    if (!searchBox || !query.trim()) return false;
    searchBox.focus();
    searchBox.value = query;
    searchBox.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: query }));
    searchBox.dispatchEvent(new Event("change", { bubbles: true }));
    for (const type of ["keydown", "keypress", "keyup"]) {
      searchBox.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }
    const form = searchBox.closest("form");
    if (form) {
      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
      if (typeof form.submit === "function") form.submit();
    }
    return true;
  }

  async function runGmailSearch(query) {
    const filled = fillSearchGmail(query);
    await wait(1200);
    if (isSearchHash(query)) return true;

    const searchButton = [...document.querySelectorAll("[aria-label], [data-tooltip], [role='button'], button")]
      .filter(isVisible)
      .find((element) => /search|pesquisar/i.test(elementSearchText(element)));
    if (searchButton) {
      activateElement(searchButton);
      await wait(1200);
    }

    if (!isSearchHash(query)) forceGmailSearchUrl(query);
    await waitForListView(7000);

    return true;
  }

  function isSearchHash(query) {
    return decodeURIComponent(location.hash).includes(`/search/${query}`);
  }

  function forceGmailSearchUrl(query) {
    const accountPrefix = location.hash.match(/^#([^/]+)\//)?.[1] || "inbox";
    const path = `${location.origin}${location.pathname}#${accountPrefix}/search/${encodeURIComponent(query)}`;
    debug(`Forçando busca por URL: ${query}`);
    location.assign(path);
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

  async function scanPageGmail(limit) {
    const targets = visibleMessageRows()
      .slice(0, limit)
      .map((row) => ({ rowKey: row.key, sender: senderFromRow(row) }))
      .filter((item) => item.sender.email || item.sender.name);
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

      debug(`Abrindo e-mail: ${target.sender.name || target.sender.email}`);
      openMessageRow(row.element);
      await wait(1800);
      await waitForMessageView();
      await waitFor(() => findUnsubscribeElements().length > 0, 3000);

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
    const results = [];
    debug(`Descadastro iniciado: ${items.length} item(ns). Limpeza: ${cleanupMode}.`);
    for (const item of items) {
      debug(`Processando saída: ${item.label || item.detail || item.id}`);
      const result = await processUnsubscribeItem(item);
      if (result.ok && cleanupMode !== "off") {
        await cleanupSenderEmails(item, cleanupMode);
      }
      results.push(result);
      await wait(1500);
    }
    debug("Descadastro finalizado.");
    return results;
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

  async function cleanupSenderEmails(item, mode) {
    const sender = senderEmailFromItem(item);
    if (!sender) {
      debug("Limpeza ignorada: remetente sem e-mail claro.");
      return false;
    }

    debug(`Limpando e-mails do remetente (${mode}): ${sender}`);
    await runGmailSearch(`from:${sender}`);

    if (mode === "safe") {
      debug(`Modo seguro: filtro aplicado para ${sender}.`);
      return true;
    }

    const selected = selectVisibleMessages();
    debug(selected ? "Mensagens visíveis selecionadas." : "Não consegui selecionar mensagens visíveis.");

    if (mode === "semi") return selected;

    const deleted = selected && clickTrashButton();
    debug(deleted ? "Cliquei na lixeira para mensagens selecionadas." : "Não encontrei a lixeira.");
    return deleted;
  }

  function senderEmailFromItem(item) {
    const value = `${item.detail || ""} ${item.label || ""}`;
    return value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "";
  }

  function selectVisibleMessages() {
    const selectBox =
      document.querySelector('[aria-label="Select"], [aria-label="Selecionar"], [data-tooltip="Select"], [data-tooltip="Selecionar"]') ||
      document.querySelector('div[role="checkbox"][aria-checked="false"]');
    if (!selectBox) return false;
    activateElement(selectBox);
    return true;
  }

  function clickTrashButton() {
    const trashButton = [...document.querySelectorAll("[aria-label], [data-tooltip], [role='button'], div[role='button']")]
      .filter(isVisible)
      .find((element) => {
        const text = elementSearchText(element);
        return /delete|trash|excluir|lixeira|mover para a lixeira/i.test(text);
      });
    if (!trashButton) return false;
    activateElement(trashButton);
    return true;
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
    const nextButton = [...document.querySelectorAll("[aria-label], [data-tooltip], [role='button'], div[role='button']")]
      .filter(isVisible)
      .find((element) => {
        const text = elementSearchText(element);
        return /^(next|próxima|proxima|mais recentes|mais antigas|older|newer)$/i.test(text) ||
          /next page|página seguinte|pagina seguinte|mais antigas/i.test(text);
      });
    if (!nextButton) return false;
    activateElement(nextButton);
    return true;
  }

  function openMessageRow(rowElement) {
    const subjectCell = rowElement.querySelector(".bog") || rowElement.querySelector("[role='link']") || rowElement.querySelector("td:nth-child(5)") || rowElement;
    activateElement(subjectCell);
  }

  async function waitForMessageView() {
    await waitFor(() => document.querySelector(".adn, [data-message-id], div[role='main'] h2") || findUnsubscribeElements().length > 0, 6500);
  }

  async function waitForListView(timeout = 5000) {
    return waitFor(() => visibleMessageRows().length > 0, timeout);
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

  async function waitFor(predicate, timeout) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (predicate()) return true;
      await wait(250);
    }
    return false;
  }
})();
