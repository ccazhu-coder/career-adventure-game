import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { signSession, verifyPassword } from "../../lib/auth.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["POST"])) return;

  try {
    const body = await readJson(req);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!username || !password) throw new Error("請輸入帳號與密碼");

    const db = supabaseAdmin();
    const user = assertDbOk(await db
      .from("users")
      .select("id, username, email, display_name, password_hash, role, status")
      .eq("username", username)
      .maybeSingle());

    if (!user || user.status !== "active") throw new Error("帳號或密碼錯誤");
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new Error("帳號或密碼錯誤");

    const token = signSession(user);
    json(res, 200, {
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    });
  } catch (error) {
    json(res, 401, { ok: false, message: safeMessage(error) });
  }
}

