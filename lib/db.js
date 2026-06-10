import { createClient } from "@supabase/supabase-js";

let client;

export function supabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase 環境變數尚未設定");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

export function assertDbOk(result, fallback = "資料庫操作失敗") {
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data;
}

