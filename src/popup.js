const scanButton = document.querySelector("#scanButton");
const deepScanButton = document.querySelector("#deepScanButton");
const filterSenderButton = document.querySelector("#filterSenderButton");
const nextPageButton = document.querySelector("#nextPageButton");
const scanLimitSelect = document.querySelector("#scanLimit");
const unsubscribeButton = document.querySelector("#unsubscribeButton");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const summaryTextEl = document.querySelector("#summaryText");
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
      subscriptions = response.items || [];
      renderSubscriptions();
      setScanStatus(subscriptions);
    });
  });
});

scanButton.addEventListener("click", async () => {
  await runAction("Lendo a tela atual...", async () => {
    const response = await sendToGmail({ type: "scanVisibleGmail" });
    subscriptions = response.items || [];
    renderSubscriptions();
    setStatus(subscriptions.length ? `${subscriptions.length} linha(s) visível(is). Use Varrer página para procurar descadastro.` : "Nada encontrado na tela atual.");
  });
});

deepScanButton.addEventListener("click", async () => {
  const limit = selectedScanLimit();
  await runAction(`Varrendo até ${limit} e-mails visíveis. Não mexa no Gmail até terminar...`, async () => {
    clearDebug();
    const response = await sendToGmail({ type: "scanPageGmail", limit });
    subscriptions = response.items || [];
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

unsubscribeButton.addEventListener("click", async () => {
  const selected = selectedSubscriptions();
  if (!selected.length) return;

  await runAction(`Saindo de ${selected.length} selecionada(s)...`, async () => {
    markItemsProcessing(selected);
    const response = await sendToGmail({ type: "unsubscribeVisibleGmail", items: selected });
    await openResultTabs(response.results || []);
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

async function openGmailSearch(query) {
  const response = await sendToGmail({ type: "fillSearchGmail", query });
  if (response.filled) return;

  const tab = await currentGmailTab();
  const url = new URL(tab.url);
  const accountPrefix = url.hash.match(/^#([^/]+)\//)?.[1] || "inbox";
  const searchUrl = `${url.origin}${url.pathname}#${accountPrefix}/search/${encodeURIComponent(query)}`;
  await chrome.tabs.update(tab.id, { url: searchUrl });
}

async function sendToGmail(message) {
  const tab = await currentGmailTab();

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/content.js"]
  });

  const response = await chrome.tabs.sendMessage(tab.id, message);
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
      if (event.target === checkbox || checkbox.disabled) return;
      checkbox.checked = !checkbox.checked;
      syncActions();
    });
    node.querySelector(".subscription-name").textContent = item.label || "Sem nome";
    node.querySelector(".subscription-email").textContent = item.detail || "Item visível no Gmail";
    node.querySelector(".subscription-count").textContent = item.source || "Gmail";
    node.querySelector(".subscription-mode").textContent = item.actionable ? "pronto" : "não achou";

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

async function openResultTabs(results) {
  for (const result of results) {
    if (result.urlToOpen) {
      await chrome.tabs.create({ url: result.urlToOpen, active: false });
      result.message = "Link de descadastro aberto.";
    }
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
}

function setBusy(busy) {
  scanButton.disabled = busy;
  deepScanButton.disabled = busy;
  filterSenderButton.disabled = busy;
  nextPageButton.disabled = busy;
  scanLimitSelect.disabled = busy;
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
  summaryTextEl.textContent = `${confirmed} confirmado(s), ${manual} precisa(m) confirmação manual, ${failed} falhou(aram).`;
}

async function saveHistory(results) {
  const current = await chrome.storage.local.get({ unsubscribeHistory: [] });
  const entries = results.map((result) => ({
    at: new Date().toISOString(),
    senderName: result.senderName || "",
    ok: Boolean(result.ok),
    message: result.message || ""
  }));
  const unsubscribeHistory = [...entries, ...current.unsubscribeHistory].slice(0, 200);
  await chrome.storage.local.set({ unsubscribeHistory });
}

function selectedScanLimit() {
  return Number(scanLimitSelect.value || 25);
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
