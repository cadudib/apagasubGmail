const scanButton = document.querySelector("#scanButton");
const deepScanButton = document.querySelector("#deepScanButton");
const filterSenderButton = document.querySelector("#filterSenderButton");
const deleteSenderButton = document.querySelector("#deleteSenderButton");
const nextPageButton = document.querySelector("#nextPageButton");
const scanLimitSelect = document.querySelector("#scanLimit");
const cleanupModeSelect = document.querySelector("#cleanupMode");
const unsubscribeButton = document.querySelector("#unsubscribeButton");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const summaryTextEl = document.querySelector("#summaryText");
const cleanupPreviewEl = document.querySelector("#cleanupPreview");
const debugLogEl = document.querySelector("#debugLog");
const clearDebugButton = document.querySelector("#clearDebugButton");
const copyDebugButton = document.querySelector("#copyDebugButton");
const selectAll = document.querySelector("#selectAll");
const template = document.querySelector("#subscriptionTemplate");
const presetButtons = document.querySelectorAll(".preset-button");

let subscriptions = [];

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "debugEvent") return;
  addDebug(message.message);
});

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
  });
});

deleteSenderButton.addEventListener("click", async () => {
  await runAction("Pegando remetente para apagar...", async () => {
    const response = await sendToGmail({ type: "getCurrentSenderGmail" });
    const sender = response.sender;
    if (!sender?.email) {
      throw new Error("Abra um e-mail com remetente visível para apagar automaticamente por endereço.");
    }
    if (!confirm(`Filtrar e enviar para a lixeira os e-mails visíveis de:\n\n${sender.email}\n\nContinuar?`)) {
      setStatus("Ação cancelada.");
      return;
    }

    const query = `from:${sender.email}`;
    setStatus(`Filtrando ${sender.email}...`);
    await openGmailSearch(query);
    await wait(4000);

    setStatus(`Selecionando e apagando e-mails de ${sender.email}...`);
    const cleanupResponse = await sendToGmail({ type: "cleanupVisibleGmail", mode: "auto", sender: sender.email });
    const cleanup = cleanupResponse.cleanup;
    subscriptions = [];
    renderSubscriptions();
    setStatus(cleanup?.message || `Limpeza concluída para ${sender.email}.`, cleanup?.deleted ? "normal" : "error");
  });
});

unsubscribeButton.addEventListener("click", async () => {
  const selected = selectedSubscriptions();
  if (!selected.length) return;
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

    setStatus(`Limpando e-mails de ${sender}...`);
    await openGmailSearch(`from:${sender}`);
    await wait(4000);

    try {
      const response = await sendToGmail({ type: "cleanupVisibleGmail", mode, sender });
      result.cleanup = response.cleanup || { attempted: false, sender, mode, message: "Limpeza sem resposta detalhada." };
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

function syncActions() {
  unsubscribeButton.disabled = selectedSubscriptions().length === 0;
  updateCleanupPreview();
}

function setBusy(busy) {
  scanButton.disabled = busy;
  deepScanButton.disabled = busy;
  filterSenderButton.disabled = busy;
  deleteSenderButton.disabled = busy;
  nextPageButton.disabled = busy;
  scanLimitSelect.disabled = busy;
  cleanupModeSelect.disabled = busy;
  presetButtons.forEach((button) => {
    button.disabled = busy;
  });
  unsubscribeButton.disabled = busy || selectedSubscriptions().length === 0;
}

function setStatus(message, type = "normal") {
  statusEl.textContent = message;
  statusEl.className = type;
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
  const cleaned = results.filter((result) => result.cleanup?.attempted).length;
  summaryTextEl.textContent = `${confirmed} confirmado(s), ${manual} precisa(m) confirmação manual, ${failed} falhou(aram), ${cleaned} limpeza(s) iniciada(s).`;
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

function confirmCleanupMode(items) {
  if (cleanupModeSelect.value !== "auto") return true;
  const senders = uniqueSenderEmails(items);
  const preview = senders.length ? senders.slice(0, 5).join("\n") : "remetentes sem e-mail claro";
  const extra = senders.length > 5 ? `\n...e mais ${senders.length - 5}` : "";
  return confirm(`Modo automático vai selecionar e enviar para a lixeira os e-mails visíveis destes remetentes após o descadastro:\n\n${preview}${extra}\n\nContinuar?`);
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
