import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { hashPassword } from "../../lib/auth.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";
import { isEmail } from "../../lib/validation.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["POST"])) return;

  try {
    const body = await readJson(req);
    const registerCode = process.env.COUNSELOR_REGISTER_CODE || "CAREER-2026";
    if (String(body.registerCode || "").trim() !== registerCode) throw new Error("註冊碼不正確");
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const displayName = String(body.displayName || "").trim();
    const email = String(body.email || username).trim().toLowerCase();
    if (!username || !password || !displayName) throw new Error("請完整填寫註冊資料");
    if (password.length < 8) throw new Error("密碼至少需要 8 個字元");
    if (!isEmail(email)) throw new Error("請輸入有效 Email");

    const db = supabaseAdmin();
    const user = assertDbOk(await db.from("users").insert({
      username,
      email,
      display_name: displayName,
      password_hash: await hashPassword(password),
      role: "consultant",
      status: "active"
    }).select("id, username, email, display_name, role").single());
    json(res, 200, { ok: true, user });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

