import { timingSafeEqual } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-write-passphrase",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...corsHeaders, "Content-Type": "application/json"},
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidPassphrase(received: string, expected: string) {
  const encoder = new TextEncoder();
  const receivedBytes = encoder.encode(received);
  const expectedBytes = encoder.encode(expected);
  return receivedBytes.length === expectedBytes.length
    && timingSafeEqual(receivedBytes, expectedBytes);
}

function validateMemo(value: Record<string, unknown>) {
  if (typeof value.url !== "string" || value.url.length > 2048) {
    throw new Error("URLは2048文字以内で入力してください。");
  }
  let url: URL;
  try {
    url = new URL(value.url);
  } catch {
    throw new Error("有効なURLを入力してください。");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:")
    || url.username || url.password) {
    throw new Error("URLには認証情報を含まない http または https のアドレスを指定してください。");
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const note = typeof value.note === "string" ? value.note.trim() : "";
  if (title.length < 1 || title.length > 200) {
    throw new Error("タイトルは1〜200文字で入力してください。");
  }
  if (note.length > 3000) {
    throw new Error("メモは3000文字以内で入力してください。");
  }
  return {url: url.href, title, note};
}

function validId(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: corsHeaders});
  }
  if (request.method !== "POST") return jsonResponse({error: "POST only"}, 405);

  const expectedPassphrase = Deno.env.get("WRITE_PASSPHRASE");
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expectedPassphrase || !projectUrl || !serviceRoleKey) {
    console.error("Required Edge Function secrets are not configured.");
    return jsonResponse({error: "書き込み機能の設定が完了していません。"}, 503);
  }
  if (new TextEncoder().encode(expectedPassphrase).length < 12) {
    console.error("WRITE_PASSPHRASE must contain at least 12 UTF-8 bytes.");
    return jsonResponse({error: "書き込み機能の合言葉設定を確認してください。"}, 503);
  }

  const receivedPassphrase = request.headers.get("x-write-passphrase") ?? "";
  if (!isValidPassphrase(receivedPassphrase, expectedPassphrase)) {
    return jsonResponse({error: "合言葉が違います。"}, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({error: "リクエストの形式が正しくありません。"}, 400);
  }
  if (!isRecord(body) || typeof body.action !== "string") {
    return jsonResponse({error: "操作の指定が正しくありません。"}, 400);
  }

  const action = body.action;
  if (action !== "create" && action !== "update" && action !== "delete") {
    return jsonResponse({error: "対応していない操作です。"}, 400);
  }

  let memo: {url: string; title: string; note: string} | undefined;
  if (action !== "delete") {
    try {
      memo = validateMemo(body);
    } catch (error) {
      return jsonResponse({error: error instanceof Error ? error.message : "入力内容を確認してください。"}, 400);
    }
  }
  if (action !== "create" && !validId(body.id)) {
    return jsonResponse({error: "メモのIDが正しくありません。"}, 400);
  }

  const endpoint = new URL("/rest/v1/url_memos", projectUrl);
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  let method: string;
  let requestUrl = endpoint;
  let requestBody: string | undefined;
  if (action === "create") {
    method = "POST";
    requestBody = JSON.stringify(memo);
  } else {
    requestUrl.searchParams.set("id", `eq.${body.id}`);
    method = action === "update" ? "PATCH" : "DELETE";
    if (action === "update") requestBody = JSON.stringify(memo);
  }

  try {
    const response = await fetch(requestUrl, {method, headers, body: requestBody});
    const responseBody = await response.text();
    if (!response.ok) {
      console.error(`Memo database request failed (${response.status}).`);
      return jsonResponse({error: "データベースへの保存に失敗しました。"}, 502);
    }
    const rows: unknown = responseBody ? JSON.parse(responseBody) : [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonResponse({error: "対象のメモが見つかりません。"}, 404);
    }
    return jsonResponse({ok: true});
  } catch (error) {
    console.error("Memo database request failed.", error);
    return jsonResponse({error: "データベースに接続できませんでした。"}, 502);
  }
});
