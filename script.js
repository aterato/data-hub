"use strict";

const config = window.DATA_HUB_SUPABASE_CONFIG;
const form = document.getElementById("memo-form");
const urlInput = document.getElementById("memo-url");
const titleInput = document.getElementById("memo-title");
const noteInput = document.getElementById("memo-note");
const categoryInput = document.getElementById("memo-category");
const passphraseInput = document.getElementById("write-passphrase");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");
const refreshButton = document.getElementById("refresh-button");
const statusElement = document.getElementById("app-status");
const memoList = document.getElementById("memo-list");
const categoryFilter = document.getElementById("category-filter");
const lastAccessElement = document.getElementById("last-access");
const accessCountElement = document.getElementById("access-count");
const accessStatusElement = document.getElementById("access-status");
const deleteDialog = document.getElementById("delete-dialog");
const deleteForm = document.getElementById("delete-form");
const deletePassphraseInput = document.getElementById("delete-passphrase");
const deleteDialogMessage = document.getElementById("delete-dialog-message");
const deleteStatusElement = document.getElementById("delete-status");
const confirmDeleteButton = document.getElementById("confirm-delete");
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const accessDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

let editingId = null;
let deletingId = null;
let memos = [];
let categories = [];
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

  const visibleMemos = memos.filter(memo => {
    if (categoryFilter.value === "all") return true;
    if (categoryFilter.value === "unclassified") return !memo.category_id;
    return memo.category_id === categoryFilter.value;
  });
  if (visibleMemos.length === 0) {
    memoList.append(createElement("li", "empty-state", "このカテゴリのメモはありません。"));
    return;
  }

  const categoryById = new Map(categories.map(category => [category.id, category]));
  for (const memo of visibleMemos) {
    const item = createElement("li", "memo-item");
    const category = categoryById.get(memo.category_id);
    if (category) {
      const badge = createElement("span", "category-badge", category.name);
      badge.style.setProperty("--badge-color", category.color);
      item.append(badge);
    }

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
    deleteButton.addEventListener("click", () => openDeleteDialog(memo));
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
      select: "id,url,title,note,category_id,created_at,updated_at",
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

async function loadCategories() {
  const configurationError = getConfigurationError();
  if (configurationError) {
    setStatus(configurationError, "error");
    return;
  }

  const query = new URLSearchParams({
    select: "id,name,color,sort_order",
    order: "sort_order.asc,name.asc",
  });
  const result = await requestJson(`${config.projectUrl}/rest/v1/memo_categories?${query}`);
  if (!Array.isArray(result) || result.some(category =>
    !category || typeof category.id !== "string" || typeof category.name !== "string"
    || typeof category.color !== "string" || !/^#[0-9a-f]{6}$/i.test(category.color))) {
    throw new Error("カテゴリ情報の形式が正しくありません。");
  }
  categories = result;

  categoryInput.replaceChildren(new Option("未分類", ""));
  categoryFilter.replaceChildren(new Option("すべて", "all"));
  for (const category of categories) {
    categoryInput.add(new Option(category.name, category.id));
    categoryFilter.add(new Option(category.name, category.id));
  }
  categoryFilter.add(new Option("未分類", "unclassified"));
  if (![...categoryFilter.options].some(option => option.value === categoryFilter.value)) {
    categoryFilter.value = "all";
  }
}

async function loadAccessStats() {
  const configurationError = getConfigurationError();
  if (configurationError) {
    accessStatusElement.textContent = configurationError;
    return;
  }

  try {
    const result = await requestJson(`${config.projectUrl}/functions/v1/memos`, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({action: "stats"}),
    });
    const count = String(result?.accessCount ?? "");
    if (!/^\d+$/.test(count)) throw new Error("利用状況の回数が正しくありません。");

    accessCountElement.textContent = Number(count).toLocaleString("ja-JP");
    if (result.lastAccessAt === null) {
      lastAccessElement.textContent = "未記録";
      lastAccessElement.removeAttribute("datetime");
    } else {
      const lastAccessDate = new Date(result.lastAccessAt);
      if (!Number.isFinite(lastAccessDate.getTime())) throw new Error("最終アクセス日時が正しくありません。");
      lastAccessElement.textContent = accessDateFormatter.format(lastAccessDate);
      lastAccessElement.dateTime = lastAccessDate.toISOString();
    }
    accessStatusElement.textContent = "";
  } catch (error) {
    accessStatusElement.textContent = `利用状況を読み込めませんでした。${error.message}`;
  }
}

function beginEdit(memo) {
  editingId = memo.id;
  urlInput.value = memo.url;
  titleInput.value = memo.title;
  noteInput.value = memo.note;
  categoryInput.value = memo.category_id ?? "";
  submitButton.textContent = "変更を保存";
  cancelEditButton.hidden = false;
  urlInput.focus();
  setStatus("内容を編集して保存してください。");
}

function resetForm() {
  form.reset();
  editingId = null;
  submitButton.textContent = "追加";
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
    category_id: categoryInput.value || null,
  };
}

async function writeMemo(action, payload, passphrase) {
  if (!passphrase) throw new Error("合言葉を入力してください。");
  try {
    return await requestJson(`${config.projectUrl}/functions/v1/memos`, {
      method: "POST",
      headers: {"content-type": "application/json", "x-write-passphrase": passphrase},
      body: JSON.stringify({action, ...payload}),
    });
  } finally {
    await loadAccessStats();
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
    const passphrase = passphraseInput.value;
    await writeMemo(editingId ? "update" : "create", editingId ? {id: editingId, ...payload} : payload, passphrase);
    resetForm();
    setStatus(wasEditing ? "メモを更新しました。" : "メモを追加しました。", "success");
    await loadMemos({silent: true});
  } catch (error) {
    setStatus(`保存できませんでした。${error.message}`, "error");
  } finally {
    passphraseInput.value = "";
    submitButton.disabled = false;
  }
});

function openDeleteDialog(memo) {
  const configurationError = getConfigurationError();
  if (configurationError) {
    setStatus(configurationError, "error");
    return;
  }
  deletingId = memo.id;
  deleteDialogMessage.textContent = `「${memo.title}」を削除します。この操作は取り消せません。`;
  deleteStatusElement.textContent = "";
  deletePassphraseInput.value = "";
  confirmDeleteButton.disabled = false;
  deleteDialog.showModal();
  deletePassphraseInput.focus();
}

async function deleteMemo() {
  const id = deletingId;
  const passphrase = deletePassphraseInput.value;
  if (!id || !passphrase) {
    deleteStatusElement.textContent = "合言葉を入力してください。";
    return;
  }

  confirmDeleteButton.disabled = true;
  deleteStatusElement.textContent = "削除しています…";
  try {
    await writeMemo("delete", {id}, passphrase);
    deleteDialog.close();
    deletingId = null;
    if (editingId === id) resetForm();
    setStatus("メモを削除しました。", "success");
    await loadMemos({silent: true});
  } catch (error) {
    deleteStatusElement.textContent = `削除できませんでした。${error.message}`;
  } finally {
    deletePassphraseInput.value = "";
    confirmDeleteButton.disabled = false;
  }
}

deleteForm.addEventListener("submit", event => {
  event.preventDefault();
  deleteMemo();
});
function clearDeleteDialog() {
  deletingId = null;
  deletePassphraseInput.value = "";
  deleteStatusElement.textContent = "";
}

document.getElementById("cancel-delete").addEventListener("click", () => {
  clearDeleteDialog();
  deleteDialog.close();
});
deleteDialog.addEventListener("close", clearDeleteDialog);

cancelEditButton.addEventListener("click", () => {
  resetForm();
  setStatus("編集を取り消しました。");
});
refreshButton.addEventListener("click", () => {
  loadCategories()
    .then(() => loadMemos())
    .catch(error => setStatus(`カテゴリを読み込めませんでした。${error.message}`, "error"));
  loadAccessStats();
});
categoryFilter.addEventListener("change", renderMemos);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadMemos({silent: true});
    loadAccessStats();
  }
});
setInterval(() => {
  if (!document.hidden) loadMemos({silent: true});
}, 30000);

if (getConfigurationError()) {
  form.querySelectorAll("input, textarea, select, button").forEach(control => {
    if (control !== refreshButton) control.disabled = true;
  });
}
loadCategories()
  .then(() => loadMemos())
  .catch(error => setStatus(`カテゴリを読み込めませんでした。${error.message}`, "error"));
loadAccessStats();
