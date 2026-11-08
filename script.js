"use strict";

const config = window.DATA_HUB_SUPABASE_CONFIG;
const form = document.getElementById("memo-form");
const urlInput = document.getElementById("memo-url");
const titleInput = document.getElementById("memo-title");
const noteInput = document.getElementById("memo-note");
const passphraseInput = document.getElementById("write-passphrase");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");
const refreshButton = document.getElementById("refresh-button");
const statusElement = document.getElementById("app-status");
const memoList = document.getElementById("memo-list");
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

let editingId = null;
let memos = [];
let loadingMemos = false;

function setStatus(message, state = "info") {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function getConfigurationError() {
  if (!config || !config.projectUrl || !config.publishableKey
    || config.publishableKey === "YOUR_SUPABASE_PUBLISHABLE_KEY") {
    return "Supabase の接続設定が未完了です。README の「Supabase の設定」を参照してください。";
  }
  try {
    const projectUrl = new URL(config.projectUrl);
    if (projectUrl.protocol !== "https:" || !projectUrl.hostname.endsWith(".supabase.co")) {
      return "Supabase の Project URL の設定を確認してください。";
    }
  } catch {
    return "Supabase の Project URL の設定を確認してください。";
  }
  return null;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderMemos() {
  memoList.replaceChildren();
  if (memos.length === 0) {
    memoList.append(createElement("li", "empty-state", "まだメモはありません。見つけたページを追加してみましょう。"));
    return;
  }

  for (const memo of memos) {
    const item = createElement("li", "memo-item");
    const heading = createElement("div", "memo-heading");
    const link = createElement("a", "memo-title", memo.title);
    link.href = memo.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    heading.append(link);

    const date = createElement("time", "memo-date", dateFormatter.format(new Date(memo.updated_at)));
    date.dateTime = memo.updated_at;
    heading.append(date);
    item.append(heading);

    const address = createElement("p", "memo-url", memo.url);
    item.append(address);
    if (memo.note) item.append(createElement("p", "memo-note", memo.note));

    const actions = createElement("div", "memo-actions");
    const editButton = createElement("button", "text-button", "編集");
    editButton.type = "button";
    editButton.addEventListener("click", () => beginEdit(memo));
    const deleteButton = createElement("button", "text-button delete-button", "削除");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteMemo(memo.id));
    actions.append(editButton, deleteButton);
    item.append(actions);
    memoList.append(item);
  }
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: config.publishableKey,
        ...options.headers,
      },
    });
    const body = await response.text();
    let data;
    try {
      data = body ? JSON.parse(body) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message = typeof data?.error === "string" ? data.error
        : typeof data?.message === "string" ? data.message : "";
      throw new Error(message || `リクエストに失敗しました（${response.status}）。`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadMemos({silent = false} = {}) {
  if (loadingMemos) return;
  const configurationError = getConfigurationError();
  if (configurationError) {
    setStatus(configurationError, "error");
    return;
  }

  loadingMemos = true;
  if (!silent) setStatus("共有リストを読み込んでいます…");
  refreshButton.disabled = true;
  try {
    const query = new URLSearchParams({
      select: "id,url,title,note,created_at,updated_at",
      order: "updated_at.desc",
    });
    const result = await requestJson(`${config.projectUrl}/rest/v1/url_memos?${query}`);
    if (!Array.isArray(result)) throw new Error("Supabase から予期しない応答がありました。");
    memos = result;
    renderMemos();
    if (!silent) setStatus(memos.length ? `${memos.length} 件のメモ` : "共有リストは空です。");
  } catch (error) {
    setStatus(`共有リストを読み込めませんでした。${error.message}`, "error");
  } finally {
    refreshButton.disabled = false;
    loadingMemos = false;
  }
}

function beginEdit(memo) {
  editingId = memo.id;
  urlInput.value = memo.url;
  titleInput.value = memo.title;
  noteInput.value = memo.note;
  submitButton.textContent = "変更を保存";
  cancelEditButton.hidden = false;
  urlInput.focus();
  setStatus("内容を編集して保存してください。");
}

function resetForm() {
  form.reset();
  editingId = null;
  submitButton.textContent = "リストに追加";
  cancelEditButton.hidden = true;
}

function memoPayload() {
  const url = new URL(urlInput.value.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("URL には http:// または https:// を指定してください。");
  }
  return {
    url: url.href,
    title: titleInput.value.trim() || url.hostname,
    note: noteInput.value.trim(),
  };
}

async function writeMemo(action, payload) {
  const passphrase = passphraseInput.value;
  if (!passphrase) throw new Error("書き込み用の合言葉を入力してください。");
  try {
    return await requestJson(`${config.projectUrl}/functions/v1/memos`, {
      method: "POST",
      headers: {"content-type": "application/json", "x-write-passphrase": passphrase},
      body: JSON.stringify({action, ...payload}),
    });
  } finally {
    passphraseInput.value = "";
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const configurationError = getConfigurationError();
  if (configurationError) {
    setStatus(configurationError, "error");
    return;
  }

  submitButton.disabled = true;
  try {
    const wasEditing = Boolean(editingId);
    const payload = memoPayload();
    await writeMemo(editingId ? "update" : "create", editingId ? {id: editingId, ...payload} : payload);
    resetForm();
    setStatus(wasEditing ? "メモを更新しました。" : "メモを追加しました。", "success");
    await loadMemos({silent: true});
  } catch (error) {
    setStatus(`保存できませんでした。${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
  }
});

async function deleteMemo(id) {
  if (!window.confirm("このメモを削除しますか？")) return;
  const configurationError = getConfigurationError();
  if (configurationError) {
    setStatus(configurationError, "error");
    return;
  }

  setStatus("メモを削除しています…");
  try {
    await writeMemo("delete", {id});
    if (editingId === id) resetForm();
    setStatus("メモを削除しました。", "success");
    await loadMemos({silent: true});
  } catch (error) {
    setStatus(`削除できませんでした。${error.message}`, "error");
  }
}

cancelEditButton.addEventListener("click", () => {
  resetForm();
  setStatus("編集を取り消しました。");
});
refreshButton.addEventListener("click", loadMemos);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadMemos({silent: true});
});
setInterval(() => {
  if (!document.hidden) loadMemos({silent: true});
}, 30000);

if (getConfigurationError()) {
  form.querySelectorAll("input, textarea, button").forEach(control => {
    if (control !== refreshButton) control.disabled = true;
  });
}
loadMemos();
