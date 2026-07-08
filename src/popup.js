const scanButton = document.querySelector("#scanButton");
const deepScanButton = document.querySelector("#deepScanButton");
const filterSenderButton = document.querySelector("#filterSenderButton");
const testPaginationButton = document.querySelector("#testPaginationButton");
const simulateDeleteSenderButton = document.querySelector("#simulateDeleteSenderButton");
const deleteCurrentPageButton = document.querySelector("#deleteCurrentPageButton");
const quarantineButton = document.querySelector("#quarantineButton");
const diagnosticButton = document.querySelector("#diagnosticButton");
const deleteSenderButton = document.querySelector("#deleteSenderButton");
const deleteDomainButton = document.querySelector("#deleteDomainButton");
const nextPageButton = document.querySelector("#nextPageButton");
const scanLimitSelect = document.querySelector("#scanLimit");
const cleanupModeSelect = document.querySelector("#cleanupMode");
const cleanupPageLimitSelect = document.querySelector("#cleanupPageLimit");
const confirmEachPageInput = document.querySelector("#confirmEachPage");
const uiModeSelect = document.querySelector("#uiMode");
const moreActionsButton = document.querySelector("#moreActionsButton");
const lastOperationTextEl = document.querySelector("#lastOperationText");
const unsubscribeButton = document.querySelector("#unsubscribeButton");
const stopActionButton = document.querySelector("#stopActionButton");
const batchSimulateButton = document.querySelector("#batchSimulateButton");
const batchDeleteButton = document.querySelector("#batchDeleteButton");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const summaryTextEl = document.querySelector("#summaryText");
const cleanupPreviewEl = document.querySelector("#cleanupPreview");
const debugLogEl = document.querySelector("#debugLog");
const historyLogEl = document.querySelector("#historyLog");
const clearDebugButton = document.querySelector("#clearDebugButton");
const copyDebugButton = document.querySelector("#copyDebugButton");
const exportLogButton = document.querySelector("#exportLogButton");
const backupJsonButton = document.querySelector("#backupJsonButton");
const exportCsvButton = document.querySelector("#exportCsvButton");
const openTrashButton = document.querySelector("#openTrashButton");
const blockedDomainsInput = document.querySelector("#blockedDomainsInput");
const protectedKeywordsInput = document.querySelector("#protectedKeywordsInput");
const requireDryRunInput = document.querySelector("#requireDryRunInput");
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const exportSettingsButton = document.querySelector("#exportSettingsButton");
const importSettingsButton = document.querySelector("#importSettingsButton");
const selectAll = document.querySelector("#selectAll");
const template = document.querySelector("#subscriptionTemplate");
const presetButtons = document.querySelectorAll(".preset-button");
const tabButtons = document.querySelectorAll(".tab-button");

// Runtime state.
let subscriptions = [];
let busy = false;
let blockedDomains = [];
let protectedKeywords = [];
let activeTab = "search";
let showMoreActions = false;
let requireDryRun = false;

// Settings and safety defaults.
const DEFAULT_BLOCKED_DOMAINS = [
  "google.com",
  "accounts.google.com",
  "apple.com",
  "icloud.com",
  "microsoft.com",
  "outlook.com",
  "live.com",
  "gov.br",
  "caixa.gov.br",
  "bb.com.br",
  "itau.com.br",
  "bradesco.com.br",
  "santander.com.br",
  "nubank.com.br",
  "mercadopago.com.br"
];
const DEFAULT_PROTECTED_KEYWORDS = ["invoice", "receipt", "security", "bank", "senha", "boleto", "nota fiscal", "pagamento", "fatura"];

blockedDomains = [...DEFAULT_BLOCKED_DOMAINS];
protectedKeywords = [...DEFAULT_PROTECTED_KEYWORDS];
loadSettings();
renderHistory();
restoreLastOperation();
applyUiVisibility();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "debugEvent") {
    addDebug(message.message);
    return;
  }
  if (message?.type === "cleanupProgress") {
    setStatus(message.message);
    addDebug(message.message);
  }
});

// Search and scan actions.
presetButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await runAction("Preenchendo a busca do Gmail...", async () => {
      await openGmailSearch(button.dataset.query);
      await wait(3500);
      setStatus("Varrendo resultados encontrados...");
      clearDebug();
      const response = await sendToGmail({ type: "scanPageGmail", limit: selectedScanLimit() });
      subscriptions = await prepareSubscriptions(response.items || []);
      renderSubscriptions();
      setScanStatus(subscriptions);
    });
  });
});

scanButton.addEventListener("click", async () => {
  await runAction("Lendo a tela atual...", async () => {
    const response = await sendToGmail({ type: "scanVisibleGmail" });
    subscriptions = await prepareSubscriptions(response.items || []);
    renderSubscriptions();
    setStatus(subscriptions.length ? `${subscriptions.length} linha(s) visível(is). Use Varrer página para procurar descadastro.` : "Nada encontrado na tela atual.");
  });
});

deepScanButton.addEventListener("click", async () => {
  const limit = selectedScanLimit();
  await runAction(`Varrendo até ${limit} e-mails visíveis. Não mexa no Gmail até terminar...`, async () => {
    clearDebug();
    const response = await sendToGmail({ type: "scanPageGmail", limit });
    subscriptions = await prepareSubscriptions(response.items || []);
    renderSubscriptions();
    setScanStatus(subscriptions);
  });
});

clearDebugButton.addEventListener("click", clearDebug);

copyDebugButton.addEventListener("click", async () => {
  const text = [...debugLogEl.children].map((item) => item.textContent).join("\n");
  await navigator.clipboard.writeText(text);
  setStatus("Debug copiado para a área de transferência.");
});

exportLogButton.addEventListener("click", async () => {
  const history = [...historyLogEl.children].map((item) => item.textContent).join("\n") || "Sem histórico nesta instalação.";
  const debug = [...debugLogEl.children].map((item) => item.textContent).join("\n") || "Sem debug nesta sessão.";
  const report = [
    `Apaga Sub ${new Date().toISOString()}`,
    "",
    `Resumo: ${summaryTextEl.textContent}`,
    `Status: ${statusEl.textContent}`,
    "",
    "Histórico:",
    history,
    "",
    "Debug:",
    debug
  ].join("\n");
  await navigator.clipboard.writeText(report);
  setStatus("Log exportado para a área de transferência.");
});

backupJsonButton.addEventListener("click", async () => {
  const stored = await chrome.storage.local.get({
    cleanupHistory: [],
    unsubscribeHistory: [],
    runReports: [],
    auditPlans: [],
    blockedDomains,
    protectedKeywords,
    lastOperation: null
  });
  const debug = [...debugLogEl.children].map((item) => item.textContent);
  const backup = {
    exportedAt: new Date().toISOString(),
    version: "V1.43",
    settings: {
      blockedDomains: stored.blockedDomains,
      protectedKeywords: stored.protectedKeywords,
      cleanupPageLimit: selectedCleanupPageLimit()
    },
    history: {
      cleanupHistory: stored.cleanupHistory,
      unsubscribeHistory: stored.unsubscribeHistory,
      runReports: stored.runReports
    },
    auditPlans: stored.auditPlans,
    lastOperation: stored.lastOperation,
    debug
  };
  await navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
  setStatus("Backup JSON copiado para a área de transferência.");
});

exportCsvButton.addEventListener("click", async () => {
  const { cleanupHistory } = await chrome.storage.local.get({ cleanupHistory: [] });
  const rows = [
    ["data", "tipo", "alvo", "query", "limite", "modo", "simulado", "paginas", "mensagens_visiveis", "apagou", "parou", "motivo"]
  ];
  for (const entry of cleanupHistory) {
    rows.push([
      entry.at || "",
      entry.type || "",
      entry.target || "",
      entry.query || "",
      entry.limit ?? "",
      entry.mode || "",
      entry.simulated ? "sim" : "nao",
      entry.pagesDeleted ?? 0,
      entry.visibleCount ?? 0,
      entry.deleted ? "sim" : "nao",
      entry.stopped ? "sim" : "nao",
      entry.stopReason || entry.message || ""
    ]);
  }
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  await navigator.clipboard.writeText(csv);
  setStatus("Histórico CSV copiado para a área de transferência.");
});

stopActionButton.addEventListener("click", async () => {
  await chrome.storage.local.set({ cleanupStopRequested: true });
  stopActionButton.disabled = true;
  setStatus("Parada solicitada. Aguarde a etapa atual terminar...");
});

saveSettingsButton.addEventListener("click", async () => {
  blockedDomains = normalizeBlockedDomains(blockedDomainsInput.value.split(/\s+/));
  protectedKeywords = normalizeKeywords(protectedKeywordsInput.value.split(/\n|,/));
  requireDryRun = requireDryRunInput.checked;
  await chrome.storage.local.set({ blockedDomains, protectedKeywords, requireDryRun });
  blockedDomainsInput.value = blockedDomains.join("\n");
  protectedKeywordsInput.value = protectedKeywords.join("\n");
  setStatus("Configurações salvas.");
});

exportSettingsButton.addEventListener("click", async () => {
  const settings = { blockedDomains, protectedKeywords, requireDryRun, cleanupPageLimit: selectedCleanupPageLimit() };
  await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
  setStatus("Configurações exportadas para a área de transferência.");
});

importSettingsButton.addEventListener("click", async () => {
  const text = await navigator.clipboard.readText();
  const settings = JSON.parse(text);
  blockedDomains = normalizeBlockedDomains(settings.blockedDomains || DEFAULT_BLOCKED_DOMAINS);
  protectedKeywords = normalizeKeywords(settings.protectedKeywords || DEFAULT_PROTECTED_KEYWORDS);
  requireDryRun = Boolean(settings.requireDryRun);
  await chrome.storage.local.set({ blockedDomains, protectedKeywords, requireDryRun });
  blockedDomainsInput.value = blockedDomains.join("\n");
  protectedKeywordsInput.value = protectedKeywords.join("\n");
  requireDryRunInput.checked = requireDryRun;
  setStatus("Configurações importadas.");
});

openTrashButton.addEventListener("click", async () => {
  const { cleanupHistory } = await chrome.storage.local.get({ cleanupHistory: [] });
  const last = cleanupHistory[0];
  if (!last?.target) {
    setStatus("Nenhuma limpeza no histórico para abrir na lixeira.", "error");
    return;
  }
  const query = last.type === "domínio" ? `in:trash from:(${last.target})` : `in:trash from:${last.target}`;
  await openGmailSearch(query);
  setStatus(`Lixeira filtrada: ${query}`);
});

nextPageButton.addEventListener("click", async () => {
  await runAction("Avançando para a próxima página do Gmail...", async () => {
    const response = await sendToGmail({ type: "goNextPageGmail" });
    if (!response.moved) throw new Error("Não encontrei o botão de próxima página do Gmail.");
    subscriptions = [];
    renderSubscriptions();
    setStatus("Próxima página aberta. Clique em Varrer página para continuar.");
  });
});

filterSenderButton.addEventListener("click", async () => {
  await runAction("Pegando remetente visível...", async () => {
    const response = await sendToGmail({ type: "getCurrentSenderGmail" });
    const sender = response.sender;
    if (!sender?.email && !sender?.name) {
      throw new Error("Abra um e-mail ou deixe uma linha de e-mail visível para filtrar o remetente.");
    }

    const query = sender.email ? `from:${sender.email}` : `from:"${sender.name}"`;
    await openGmailSearch(query);
    subscriptions = [];
    renderSubscriptions();
    setStatus(`Filtro aplicado: ${query}. Agora selecione e apague em lote no Gmail.`);
    markGuideDone("guideFilter");
  });
});

deleteSenderButton.addEventListener("click", async () => {
  await runAction("Pegando remetente para apagar...", async () => {
    const response = await sendToGmail({ type: "getCurrentSenderGmail" });
    const sender = response.sender;
    await runSenderCleanup(sender, { simulate: false });
  });
});

deleteCurrentPageButton.addEventListener("click", async () => {
  await runAction("Pegando remetente para apagar página atual...", async () => {
    const response = await sendToGmail({ type: "getCurrentSenderGmail" });
    const sender = response.sender;
    await runSenderCleanup(sender, { simulate: false, pageLimitOverride: 1 });
  });
});

quarantineButton.addEventListener("click", async () => {
  await runAction("Preparando quarentena do remetente...", async () => {
    const response = await sendToGmail({ type: "getCurrentSenderGmail" });
    const sender = response.sender;
    await runSenderCleanup(sender, { simulate: false, modeOverride: "semi", pageLimitOverride: 1 });
  });
});

diagnosticButton.addEventListener("click", async () => {
  await runAction("Executando diagnóstico do Gmail...", async () => {
    const response = await sendToGmail({ type: "diagnoseGmail" });
    const info = response.diagnostic;
    const nextDetail = info.nextPageButton ? ` (${info.nextPageLabel || "sem rótulo"}${info.nextPageDisabled ? ", desativada" : ""})` : "";
    const checks = [
      ["busca", info.searchBox],
      ["linhas", info.rows > 0],
      ["seleção", info.selectBox],
      ["seleção ativa", info.activeSelection],
      ["lixeira", info.trashButton],
      ["próxima", info.nextPageButton]
    ];
    const message = `Diagnóstico: ${checks.map(([label, ok]) => `${ok ? "PASS" : "FAIL"} ${label}`).join(", ")}; linhas ${info.rows}; próxima ${yesNo(info.nextPageButton)}${nextDetail}.`;
    addDebug(message);
    setStatus(message);
  });
});

deleteDomainButton.addEventListener("click", async () => {
  await runAction("Pegando domínio para apagar...", async () => {
    const response = await sendToGmail({ type: "getCurrentSenderGmail" });
    const sender = response.sender;
    await runSenderCleanup(sender, { simulate: false, byDomain: true });
  });
});

simulateDeleteSenderButton.addEventListener("click", async () => {
  await runAction("Simulando limpeza do remetente...", async () => {
    const response = await sendToGmail({ type: "getCurrentSenderGmail" });
    const sender = response.sender;
    await runSenderCleanup(sender, { simulate: true });
  });
});

testPaginationButton.addEventListener("click", async () => {
  await runAction("Testando paginação do remetente...", async () => {
    const response = await sendToGmail({ type: "getCurrentSenderGmail" });
    const sender = response.sender;
    await runSenderCleanup(sender, { simulate: true, paginationOnly: true });
  });
});

unsubscribeButton.addEventListener("click", async () => {
  let selected = selectedSubscriptions();
  if (!selected.length) return;
  if (cleanupModeSelect.value === "auto") {
    selected = deselectBlockedItems(selected, "limpeza automática");
    if (!selected.length) {
      setStatus("Todos os itens selecionados foram desmarcados por bloqueios de segurança.", "error");
      return;
    }
  }
  if (!confirmCleanupMode(selected)) return;

  await runAction(`Saindo de ${selected.length} selecionada(s)...`, async () => {
    markItemsProcessing(selected);
    const response = await sendToGmail({ type: "unsubscribeVisibleGmail", items: selected, cleanupMode: cleanupModeSelect.value });
    await openResultTabs(response.results || []);
    await cleanupAfterUnsubscribe(response.results || []);
    await saveHistory(response.results || []);
    renderResults(response.results || []);
    setRunSummary(response.results || []);
    setStatus("Processo concluído. Abas abertas ainda podem exigir confirmação.");
  });
});

selectAll.addEventListener("change", () => {
  document.querySelectorAll(".subscription-check").forEach((checkbox) => {
    if (checkbox.disabled) return;
    checkbox.checked = selectAll.checked;
  });
  syncActions();
});

cleanupModeSelect.addEventListener("change", syncActions);
cleanupPageLimitSelect.addEventListener("change", saveUiPrefs);
uiModeSelect.addEventListener("change", () => {
  saveUiPrefs();
  applyUiVisibility();
});
moreActionsButton.addEventListener("click", () => {
  showMoreActions = !showMoreActions;
  saveUiPrefs();
  applyUiVisibility();
});
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab || "search";
    saveUiPrefs();
    applyUiVisibility();
  });
});

batchSimulateButton.addEventListener("click", async () => {
  await runBatchCleanup({ simulate: true });
});

batchDeleteButton.addEventListener("click", async () => {
  await runBatchCleanup({ simulate: false });
});

// Gmail communication.
async function openGmailSearch(query) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await sendToGmail({ type: "runSearchGmail", query });
      if (response.searched) {
        await wait(1000);
        return;
      }
      addDebug(`Busca não confirmou na tentativa ${attempt}; tentando novamente.`);
    } catch (error) {
      addDebug(`Busca pelo Gmail falhou na tentativa ${attempt}: ${error.message}`);
    }
    await wait(1000);
  }

  const tab = await currentGmailTab();
  const url = new URL(tab.url);
  const searchUrl = `${url.origin}${url.pathname}#search/${encodeURIComponent(query)}`;
  await chrome.tabs.update(tab.id, { url: searchUrl });
}

async function sendToGmail(message) {
  const tab = await currentGmailTab();

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });
  } catch (error) {
    throw new Error(`Não consegui ativar a extensão no Gmail: ${error.message}`);
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    throw new Error(`Não consegui falar com a aba do Gmail: ${error.message}`);
  }
  if (!response) {
    throw new Error("A aba do Gmail não respondeu. Recarregue a página e tente novamente.");
  }
  if (!response?.ok) {
    throw new Error(response?.error || "Não consegui ler o Gmail. Recarregue a página e tente novamente.");
  }
  return response;
}

async function currentGmailTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://mail.google.com/")) {
    throw new Error("Abra uma aba do Gmail antes de usar a extensão.");
  }
  return tab;
}

async function runAction(message, action) {
  await chrome.storage.local.set({ cleanupStopRequested: false });
  setBusy(true);
  setStatus(message);
  try {
    await action();
  } catch (error) {
    resetProcessingItems();
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

// Cleanup workflows.
async function runSenderCleanup(sender, { simulate, byDomain = false, paginationOnly = false, pageLimitOverride = null, modeOverride = "" }) {
  if (!sender?.email) {
    throw new Error("Abra um e-mail com remetente visível para limpar automaticamente por endereço.");
  }
  const domain = emailDomain(sender.email);
  const target = byDomain ? domain : sender.email;
  const query = byDomain ? `from:(${domain})` : `from:${sender.email}`;
  const blocked = !simulate ? blockedSenderReason(target) : "";
  if (blocked) {
    throw new Error(`Remetente bloqueado por segurança: ${blocked}. Use o Gmail manualmente para esse caso.`);
  }
  if (byDomain && !domain) {
    throw new Error("Não consegui identificar o domínio do remetente.");
  }
  const pageLimit = pageLimitOverride ?? selectedCleanupPageLimit();
  const limitText = pageLimit === 0 ? "até acabar" : `${pageLimit} página(s)`;
  const runId = createRunId();
  const confirmText = byDomain
    ? `ATENÇÃO: isso vai buscar e enviar para a lixeira mensagens visíveis do domínio inteiro:\n\n${domain}\n\nContinuar?`
    : `Filtrar e enviar para a lixeira os e-mails visíveis de:\n\n${sender.email}\n\nLimite: ${limitText}\n\nContinuar?`;
  if (!simulate && !confirm(confirmText)) {
    setStatus("Ação cancelada.");
    return;
  }
  if (!simulate && modeOverride !== "semi" && !(await dryRunAllowed(target))) {
    throw new Error(`Simule este alvo antes de apagar: ${target}`);
  }
  if (!simulate && modeOverride !== "semi") {
    await saveAuditPlan({ runId, target, query, byDomain, pageLimit, source: "single" });
  }

  setStatus(`${simulate ? "Simulando" : "Filtrando"} ${target}...`);
  await openGmailSearch(query);
  await wait(4000);

  setStatus(simulate ? `Contando paginação de ${target}...` : `Selecionando e apagando e-mails de ${target}...`);
  const mode = modeOverride || (simulate ? "simulate" : "auto");
  const cleanupResponse = await sendToGmail({ type: "cleanupVisibleGmail", mode, sender: target, pageLimit, paginationOnly, confirmEachPage: confirmEachPageInput.checked });
  const cleanup = cleanupResponse.cleanup;
  cleanup.runId = runId;
  subscriptions = [];
  renderSubscriptions();
  setCleanupSummary(cleanup);
  await saveCleanupHistory({ target, query, byDomain, cleanup });
  await saveRunReport({ runId, target, query, byDomain, cleanup, simulate, pageLimit });
  if (simulate) await saveDryRun(target);
  await renderHistory();
  setStatus(cleanup?.message || `Limpeza concluída para ${target}.`, cleanup?.deleted || cleanup?.simulated ? "normal" : "error");
}

async function runBatchCleanup({ simulate }) {
  const selected = !simulate ? deselectBlockedItems(selectedSubscriptions(), "lote") : selectedSubscriptions();
  const senders = uniqueSenderEmails(selected);
  if (!senders.length) {
    setStatus("Selecione itens com e-mail de remetente para executar lote.", "error");
    return;
  }
  const blocked = !simulate ? senders.map(blockedSenderReason).filter(Boolean) : [];
  const runnable = !simulate ? senders.filter((sender) => !blockedSenderReason(sender)) : senders;
  if (blocked.length) addDebug(`Lote ignorou bloqueados: ${blocked.join(" | ")}`);
  if (!runnable.length) {
    setStatus("Todos os remetentes selecionados estão bloqueados por segurança.", "error");
    return;
  }
  const limit = selectedCleanupPageLimit();
  const limitText = limit === 0 ? "até acabar" : `${limit} página(s)`;
  const preview = runnable.slice(0, 12).join("\n");
  const blockedText = blocked.length ? `\n\nBloqueados/ignorados:\n${blocked.slice(0, 8).join("\n")}` : "";
  if (!simulate && !confirm(`Executar apagar lote para ${runnable.length} remetente(s)?\n\nLimite por remetente: ${limitText}\n\nRemetentes:\n${preview}${runnable.length > 12 ? "\n..." : ""}${blockedText}\n\nContinuar?`)) return;
  if (!simulate) {
    await saveAuditPlan({ target: runnable.join(", "), query: "batch", byDomain: false, pageLimit: limit, source: "batch", count: runnable.length });
  }

  await runAction(simulate ? "Simulando lote..." : "Apagando lote...", async () => {
    renderBatchQueue(runnable, "pendente");
    for (const [index, email] of runnable.entries()) {
      setStatus(`${simulate ? "Simulando" : "Apagando"} ${index + 1}/${runnable.length}: ${email}`);
      updateBatchQueue(email, "processando");
      await runSenderCleanup({ email }, { simulate });
      updateBatchQueue(email, "concluído");
      if (await stopRequested()) break;
    }
    setStatus(simulate ? "Simulação em lote concluída." : "Limpeza em lote concluída.");
  });
}

function renderBatchQueue(emails, state) {
  resultsEl.innerHTML = '<div class="batch-queue"></div>';
  const queue = resultsEl.querySelector(".batch-queue");
  for (const email of emails) {
    const item = document.createElement("div");
    item.dataset.email = email;
    item.textContent = `${email}: ${state}`;
    queue.appendChild(item);
  }
}

function updateBatchQueue(email, state) {
  const item = resultsEl.querySelector(`[data-email="${CSS.escape(email)}"]`);
  if (item) item.textContent = `${email}: ${state}`;
}

function renderSubscriptions() {
  resultsEl.innerHTML = "";
  selectAll.checked = false;

  if (!subscriptions.length) {
    resultsEl.innerHTML = '<div class="empty">Use uma busca pronta e depois clique em Varrer página.</div>';
    syncActions();
    return;
  }

  for (const item of subscriptions) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector(".subscription");
    const checkbox = node.querySelector(".subscription-check");

    article.dataset.id = item.id;
    article.dataset.state = item.actionable ? "ready" : "missing";
    checkbox.disabled = item.actionable === false;
    checkbox.addEventListener("change", syncActions);
    article.addEventListener("click", (event) => {
      if (event.target.closest(".subscription-main") || checkbox.disabled) return;
      checkbox.checked = !checkbox.checked;
      syncActions();
    });
    node.querySelector(".subscription-name").textContent = item.label || "Sem nome";
    node.querySelector(".subscription-email").textContent = item.detail || "Item visível no Gmail";
    node.querySelector(".subscription-count").textContent = item.source || "Gmail";
    node.querySelector(".subscription-mode").textContent = item.historyStatus || (item.actionable ? "pronto" : "não achou");

    resultsEl.appendChild(node);
  }

  syncActions();
}

// Rendering and state helpers.
function renderResults(results) {
  markResultStates(results);
  if (document.querySelectorAll(".subscription").length) {
    syncActions();
    return;
  }
  resultsEl.innerHTML = "";
  for (const result of results) {
    const div = document.createElement("div");
    div.className = result.ok ? "success" : "error";
    div.textContent = `${result.senderName || "Assinatura"}: ${result.message}`;
    resultsEl.appendChild(div);
  }
  subscriptions = [];
  selectAll.checked = false;
  syncActions();
}

function markResultStates(results) {
  for (const result of results) {
    const article = document.querySelector(`.subscription[data-id="${CSS.escape(result.id)}"]`);
    if (!article) continue;
    const mode = article.querySelector(".subscription-mode");
    article.dataset.state = result.ok ? "confirmed" : "failed";
    mode.textContent = result.ok
      ? result.message.includes("Confirme manualmente") || result.message.includes("aberto")
        ? "precisa manual"
        : "confirmado"
      : "falhou";
  }
}

function markItemsProcessing(items) {
  for (const item of items) {
    const article = document.querySelector(`.subscription[data-id="${CSS.escape(item.id)}"]`);
    if (!article) continue;
    article.dataset.state = "processing";
    article.querySelector(".subscription-mode").textContent = "processando";
  }
}

function resetProcessingItems() {
  document.querySelectorAll('.subscription[data-state="processing"]').forEach((article) => {
    article.dataset.state = "ready";
    article.querySelector(".subscription-mode").textContent = "pronto";
  });
}

async function openResultTabs(results) {
  for (const result of results) {
    if (result.urlToOpen) {
      if (!isSafeHttpUrl(result.urlToOpen)) {
        result.ok = false;
        result.message = "Link de descadastro bloqueado por protocolo inseguro.";
        continue;
      }
      try {
        await chrome.tabs.create({ url: result.urlToOpen, active: false });
        result.message = "Link de descadastro aberto.";
      } catch (error) {
        result.ok = false;
        result.message = `Não consegui abrir o link de descadastro: ${error.message}`;
      }
    }
  }
}

async function cleanupAfterUnsubscribe(results) {
  const mode = cleanupModeSelect.value;
  if (mode === "off") {
    results.forEach((result) => {
      result.cleanup = { attempted: false, mode, message: "Limpeza desligada." };
    });
    return;
  }

  for (const result of results) {
    if (!result.ok) continue;
    if (result.urlToOpen) {
      result.cleanup = {
        attempted: false,
        sender: result.senderEmail || "",
        mode,
        message: "Link externo aberto; limpeza não executada automaticamente."
      };
      continue;
    }

    const sender = result.senderEmail || result.cleanup?.sender || "";
    if (!sender) {
      result.cleanup = { attempted: false, sender: "", mode, message: "Remetente sem e-mail claro." };
      continue;
    }
    const blocked = mode === "auto" ? blockedSenderReason(sender) : "";
    if (blocked) {
      result.cleanup = { attempted: false, sender, mode, message: `Remetente bloqueado por segurança: ${blocked}.` };
      addDebug(result.cleanup.message);
      continue;
    }

    setStatus(`Limpando e-mails de ${sender}...`);
    await openGmailSearch(`from:${sender}`);
    await wait(4000);

    try {
      const response = await sendToGmail({ type: "cleanupVisibleGmail", mode, sender, pageLimit: selectedCleanupPageLimit() });
      result.cleanup = response.cleanup || { attempted: false, sender, mode, message: "Limpeza sem resposta detalhada." };
      setCleanupSummary(result.cleanup);
      await saveCleanupHistory({ target: sender, query: `from:${sender}`, byDomain: false, cleanup: result.cleanup });
    } catch (error) {
      result.cleanup = { attempted: false, sender, mode, message: `Falha na limpeza: ${error.message}` };
      addDebug(result.cleanup.message);
    }
  }
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectedSubscriptions() {
  return [...document.querySelectorAll(".subscription")]
    .filter((article) => {
      const checkbox = article.querySelector(".subscription-check");
      return checkbox.checked && !checkbox.disabled;
    })
    .map((article) => subscriptions.find((item) => item.id === article.dataset.id))
    .filter(Boolean);
}

function deselectBlockedItems(items, context) {
  const allowed = [];
  const blockedMessages = [];
  for (const item of items) {
    const email = senderEmailFromItem(item);
    const reason = (email && blockedSenderReason(email)) || protectedKeywordReason(item);
    if (reason) {
      blockedMessages.push(reason);
      uncheckSubscription(item.id);
      continue;
    }
    allowed.push(item);
  }
  if (blockedMessages.length) {
    addDebug(`${context}: ${blockedMessages.length} item(ns) bloqueado(s) desmarcado(s): ${blockedMessages.slice(0, 8).join(" | ")}`);
    setStatus(`${blockedMessages.length} bloqueado(s) desmarcado(s); seguindo com ${allowed.length}.`);
    syncActions();
  }
  return allowed;
}

function uncheckSubscription(id) {
  const article = document.querySelector(`.subscription[data-id="${CSS.escape(id)}"]`);
  const checkbox = article?.querySelector(".subscription-check");
  if (checkbox) checkbox.checked = false;
}

function syncActions() {
  const selected = selectedSubscriptions();
  unsubscribeButton.disabled = selected.length === 0;
  batchSimulateButton.disabled = busy || selected.length === 0;
  batchDeleteButton.disabled = busy || selected.length === 0;
  updateCleanupPreview();
}

function setBusy(isBusy) {
  busy = isBusy;
  scanButton.disabled = isBusy;
  deepScanButton.disabled = isBusy;
  filterSenderButton.disabled = isBusy;
  testPaginationButton.disabled = isBusy;
  simulateDeleteSenderButton.disabled = isBusy;
  deleteCurrentPageButton.disabled = isBusy;
  quarantineButton.disabled = isBusy;
  diagnosticButton.disabled = isBusy;
  deleteSenderButton.disabled = isBusy;
  deleteDomainButton.disabled = isBusy;
  nextPageButton.disabled = isBusy;
  scanLimitSelect.disabled = isBusy;
  cleanupModeSelect.disabled = isBusy;
  cleanupPageLimitSelect.disabled = isBusy;
  stopActionButton.disabled = !isBusy;
  batchSimulateButton.disabled = isBusy || selectedSubscriptions().length === 0;
  batchDeleteButton.disabled = isBusy || selectedSubscriptions().length === 0;
  presetButtons.forEach((button) => {
    button.disabled = isBusy;
  });
  unsubscribeButton.disabled = isBusy || selectedSubscriptions().length === 0;
}

function setStatus(message, type = "normal") {
  statusEl.textContent = message;
  statusEl.className = type;
  saveLastOperation(message, type);
}

function setScanStatus(items) {
  const found = items.filter((item) => item.actionable).length;
  const missing = items.length - found;
  if (found) {
    setStatus(`${found} descadastro(s) pronto(s). ${missing} e-mail(s) sem link detectado.`);
    return;
  }
  setStatus("Não achei descadastro acionável nos e-mails visíveis.");
}

function setRunSummary(results) {
  const confirmed = results.filter((result) => result.ok && !/manual|aberto|confirme/i.test(result.message)).length;
  const manual = results.filter((result) => result.ok && /manual|aberto|confirme/i.test(result.message)).length;
  const failed = results.filter((result) => !result.ok).length;
  const cleanups = results.map((result) => result.cleanup).filter(Boolean);
  const cleaned = cleanups.filter((cleanup) => cleanup.attempted).length;
  const pages = cleanups.reduce((total, cleanup) => total + Number(cleanup.pagesDeleted || 0), 0);
  const stopped = cleanups.some((cleanup) => cleanup.stopped);
  summaryTextEl.textContent = `${confirmed} confirmado(s), ${manual} precisa(m) confirmação manual, ${failed} falhou(aram), ${cleaned} limpeza(s), ${pages} página(s) apagada(s)${stopped ? ", parada solicitada" : ""}.`;
}

function setCleanupSummary(cleanup) {
  if (!cleanup) return;
  if (cleanup.simulated) {
    summaryTextEl.textContent = `Simulação: ${cleanup.visibleCount || 0} mensagem(ns), ${cleanup.pagesSeen || 1} página(s), próxima página: ${cleanup.hasNextPage ? "sim" : "não"}.`;
    markGuideDone(cleanup.paginationOnly ? "guidePage" : "guideSimulate");
    return;
  }
  summaryTextEl.textContent = `Limpeza: ${cleanup.pagesDeleted || 0} página(s) apagada(s), selecionou: ${cleanup.selected ? "sim" : "não"}, apagou: ${cleanup.deleted ? "sim" : "não"}${cleanup.stopped ? ", parada solicitada" : ""}.`;
  if (cleanup.deleted) markGuideDone("guideDelete");
}

async function saveHistory(results) {
  const current = await chrome.storage.local.get({ unsubscribeHistory: [] });
  const entries = results.map((result) => ({
    at: new Date().toISOString(),
    senderName: result.senderName || "",
    senderEmail: result.senderEmail || result.cleanup?.sender || "",
    cleanupMode: result.cleanupMode || cleanupModeSelect.value || "safe",
    unsubscribeDomain: domainFromUrl(result.urlToOpen),
    ok: Boolean(result.ok),
    message: result.message || ""
  }));
  const unsubscribeHistory = [...entries, ...current.unsubscribeHistory].slice(0, 200);
  await chrome.storage.local.set({ unsubscribeHistory });
}

async function saveCleanupHistory({ target, query, byDomain, cleanup }) {
  if (!cleanup) return;
  const current = await chrome.storage.local.get({ cleanupHistory: [] });
  const entry = {
    at: new Date().toISOString(),
    runId: cleanup.runId || "",
    target,
    query,
    type: byDomain ? "domínio" : "remetente",
    limit: selectedCleanupPageLimit(),
    mode: cleanup.mode || "auto",
    simulated: Boolean(cleanup.simulated),
    pagesDeleted: Number(cleanup.pagesDeleted || 0),
    visibleCount: Number(cleanup.visibleCount || 0),
    pagesSeen: Number(cleanup.pagesSeen || 0),
    hasNextPage: Boolean(cleanup.hasNextPage),
    pageReport: cleanup.pageReport || [],
    deleted: Boolean(cleanup.deleted),
    stopped: Boolean(cleanup.stopped),
    stopReason: cleanup.stopReason || cleanup.message || "",
    message: cleanup.message || ""
  };
  const cleanupHistory = [entry, ...current.cleanupHistory].slice(0, 30);
  await chrome.storage.local.set({ cleanupHistory });
}

async function saveRunReport({ runId, target, query, byDomain, cleanup, simulate, pageLimit }) {
  const current = await chrome.storage.local.get({ runReports: [] });
  const report = {
    at: new Date().toISOString(),
    runId,
    target,
    query,
    type: byDomain ? "domínio" : "remetente",
    simulated: Boolean(simulate),
    limit: pageLimit,
    pagesDeleted: Number(cleanup?.pagesDeleted || 0),
    visibleCount: Number(cleanup?.visibleCount || 0),
    pagesSeen: Number(cleanup?.pagesSeen || 0),
    deleted: Boolean(cleanup?.deleted),
    stopped: Boolean(cleanup?.stopped),
    stopReason: cleanup?.stopReason || "",
    message: cleanup?.message || ""
  };
  const runReports = [report, ...current.runReports].slice(0, 80);
  await chrome.storage.local.set({ runReports });
  summaryTextEl.textContent = `Execução ${runId}: ${report.message}`;
}

async function saveAuditPlan(plan) {
  const current = await chrome.storage.local.get({ auditPlans: [] });
  const entry = {
    at: new Date().toISOString(),
    runId: plan.runId || "",
    target: plan.target,
    query: plan.query,
    type: plan.byDomain ? "domínio" : "remetente",
    source: plan.source || "single",
    count: plan.count || 1,
    limit: plan.pageLimit,
    blockedDomains,
    protectedKeywords
  };
  const auditPlans = [entry, ...current.auditPlans].slice(0, 50);
  await chrome.storage.local.set({ auditPlans });
  addDebug(`Plano de auditoria salvo: ${entry.source} ${entry.target}, limite ${entry.limit === 0 ? "até acabar" : entry.limit}.`);
}

async function renderHistory() {
  if (!historyLogEl) return;
  const { cleanupHistory } = await chrome.storage.local.get({ cleanupHistory: [] });
  historyLogEl.innerHTML = "";
  const entries = cleanupHistory.slice(0, 6);
  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = "Nenhuma limpeza registrada.";
    historyLogEl.appendChild(item);
    return;
  }
  for (const entry of entries) {
    const item = document.createElement("li");
    const date = new Date(entry.at).toLocaleString();
    const action = entry.simulated ? "simulação" : entry.deleted ? "apagou" : "falhou";
    item.textContent = `${date}: ${entry.type} ${entry.target} - ${action}, ${entry.pagesDeleted || 0} pág., limite ${entry.limit ?? "-"} ${entry.stopped ? "(parado)" : ""}`;
    historyLogEl.appendChild(item);
  }
}

// Settings and safety helpers.
async function loadSettings() {
  const stored = await chrome.storage.local.get({ blockedDomains: DEFAULT_BLOCKED_DOMAINS, protectedKeywords: DEFAULT_PROTECTED_KEYWORDS, requireDryRun: false, uiPrefs: {} });
  blockedDomains = normalizeBlockedDomains(stored.blockedDomains);
  protectedKeywords = normalizeKeywords(stored.protectedKeywords);
  requireDryRun = Boolean(stored.requireDryRun);
  blockedDomainsInput.value = blockedDomains.join("\n");
  protectedKeywordsInput.value = protectedKeywords.join("\n");
  requireDryRunInput.checked = requireDryRun;
  if (stored.uiPrefs?.mode) uiModeSelect.value = stored.uiPrefs.mode;
  if (stored.uiPrefs?.tab) activeTab = stored.uiPrefs.tab;
  if (typeof stored.uiPrefs?.showMoreActions === "boolean") showMoreActions = stored.uiPrefs.showMoreActions;
  if (stored.uiPrefs?.cleanupPageLimit) cleanupPageLimitSelect.value = String(stored.uiPrefs.cleanupPageLimit);
  applyUiVisibility();
}

async function saveUiPrefs() {
  await chrome.storage.local.set({
    uiPrefs: {
      mode: uiModeSelect.value,
      tab: activeTab,
      showMoreActions,
      cleanupPageLimit: selectedCleanupPageLimit()
    }
  });
}

function normalizeBlockedDomains(values) {
  return [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))].sort();
}

function normalizeKeywords(values) {
  return [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))].sort();
}

async function prepareSubscriptions(items) {
  const history = await loadHistoryIndex();
  const deduped = [];
  const seenActionable = new Set();

  for (const item of items) {
    const key = senderKey(item);
    const historyEntry = key ? history.get(key) : null;
    const next = {
      ...item,
      historyStatus: historyEntry ? (historyEntry.ok ? "já cancelado" : "já tentado") : ""
    };

    if (next.actionable && key) {
      if (seenActionable.has(key)) continue;
      seenActionable.add(key);
    }

    deduped.push(next);
  }

  return deduped;
}

async function loadHistoryIndex() {
  const { unsubscribeHistory } = await chrome.storage.local.get({ unsubscribeHistory: [] });
  const index = new Map();
  for (const entry of unsubscribeHistory) {
    const key = senderKey({ label: entry.senderName, detail: entry.senderEmail || entry.senderName });
    if (key && !index.has(key)) index.set(key, entry);
  }
  return index;
}

function senderKey(item) {
  const value = `${item.detail || ""} ${item.label || ""}`.toLowerCase();
  const email = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  if (email) return email;
  return (item.label || item.detail || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

function selectedScanLimit() {
  return Number(scanLimitSelect.value || 25);
}

function selectedCleanupPageLimit() {
  return Number(cleanupPageLimitSelect.value || 20);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function confirmCleanupMode(items) {
  if (cleanupModeSelect.value !== "auto") return true;
  const senders = uniqueSenderEmails(items);
  const blocked = senders.map(blockedSenderReason).find(Boolean);
  if (blocked) {
    alert(`Há remetente bloqueado por segurança: ${blocked}. Ele será ignorado na limpeza automática.`);
  }
  const preview = senders.length ? senders.slice(0, 5).join("\n") : "remetentes sem e-mail claro";
  const extra = senders.length > 5 ? `\n...e mais ${senders.length - 5}` : "";
  return confirm(`Modo automático vai selecionar e enviar para a lixeira os e-mails visíveis destes remetentes após o descadastro:\n\n${preview}${extra}\n\nContinuar?`);
}

function blockedSenderReason(email) {
  const domain = emailDomain(email);
  if (!domain) return "";
  const blocked = blockedDomains.find((item) => domain === item || domain.endsWith(`.${item}`));
  return blocked ? `${email} (${blocked})` : "";
}

function protectedKeywordReason(item) {
  const text = `${item.label || ""} ${item.detail || ""}`.toLowerCase();
  const keyword = protectedKeywords.find((value) => text.includes(value));
  return keyword ? `${item.label || item.detail || "item"} (${keyword})` : "";
}

function yesNo(value) {
  return value ? "ok" : "não";
}

function createRunId(prefix = "run") {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

async function saveDryRun(target) {
  const current = await chrome.storage.local.get({ dryRuns: {} });
  const dryRuns = { ...current.dryRuns, [target]: Date.now() };
  await chrome.storage.local.set({ dryRuns });
}

async function dryRunAllowed(target) {
  if (!requireDryRun) return true;
  const { dryRuns } = await chrome.storage.local.get({ dryRuns: {} });
  const at = Number(dryRuns[target] || 0);
  return Date.now() - at <= 15 * 60 * 1000;
}

async function stopRequested() {
  const { cleanupStopRequested } = await chrome.storage.local.get({ cleanupStopRequested: false });
  return Boolean(cleanupStopRequested);
}

function emailDomain(email) {
  return String(email || "").toLowerCase().split("@").pop().trim();
}

function updateCleanupPreview() {
  const selected = selectedSubscriptions();
  const senders = uniqueSenderEmails(selected);
  const descriptions = {
    safe: "Modo seguro: depois do descadastro, a extensão só aplica o filtro do remetente.",
    semi: "Modo semi: depois do descadastro, a extensão aplica o filtro e seleciona mensagens visíveis.",
    auto: "Modo auto: depois do descadastro, a extensão aplica o filtro e envia mensagens visíveis para a lixeira.",
    off: "Sem limpeza: a extensão só tenta o descadastro."
  };
  cleanupPreviewEl.textContent = `${descriptions[cleanupModeSelect.value] || descriptions.safe} Selecionadas: ${selected.length}; ${senders.length || "nenhum"} remetente(s) com e-mail.`;
  cleanupPreviewEl.dataset.mode = cleanupModeSelect.value;
}

function uniqueSenderEmails(items) {
  return [...new Set(items.map(senderEmailFromItem).filter(Boolean))];
}

function senderEmailFromItem(item) {
  const value = `${item.detail || ""} ${item.label || ""}`;
  return value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "";
}

function domainFromUrl(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function addDebug(message) {
  const item = document.createElement("li");
  item.textContent = message;
  debugLogEl.appendChild(item);
  while (debugLogEl.children.length > 40) {
    debugLogEl.firstElementChild.remove();
  }
  debugLogEl.scrollTop = debugLogEl.scrollHeight;
}

function clearDebug() {
  debugLogEl.innerHTML = "";
}

function applyUiVisibility() {
  const isAdvanced = uiModeSelect.value === "advanced";
  moreActionsButton.textContent = showMoreActions ? "Menos ações" : "Mais ações";
  tabButtons.forEach((button) => {
    button.setAttribute("aria-selected", String((button.dataset.tab || "search") === activeTab));
  });
  document.querySelectorAll("[data-group]").forEach((element) => {
    const sameGroup = (element.dataset.group || "").split(/\s+/).includes(activeTab);
    const advancedAllowed = element.dataset.advanced !== "true" || (isAdvanced && showMoreActions);
    element.hidden = !sameGroup || !advancedAllowed;
  });
  document.querySelectorAll("[data-group-panel]").forEach((element) => {
    const groups = (element.dataset.groupPanel || "").split(/\s+/);
    element.hidden = !groups.includes(activeTab);
  });
}

function markGuideDone(id) {
  const item = document.querySelector(`#${id}`);
  if (item) item.dataset.done = "true";
}

async function saveLastOperation(message, type = "normal") {
  if (!message) return;
  const lastOperation = { at: new Date().toISOString(), message, type };
  if (lastOperationTextEl) lastOperationTextEl.textContent = `Última: ${message}`;
  await chrome.storage.local.set({ lastOperation });
}

async function restoreLastOperation() {
  const { lastOperation } = await chrome.storage.local.get({ lastOperation: null });
  if (!lastOperation?.message || !lastOperationTextEl) return;
  lastOperationTextEl.textContent = `Última: ${lastOperation.message}`;
}
