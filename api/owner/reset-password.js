import { requireUser, hashPassword } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["POST"])) return;

  try {
    await requireUser(req, ["owner"]);
    const body = await readJson(req);
    const id = String(body.id || body.username || "").trim();
    const password = String(body.newPassword || body.password || "");
    if (!id || password.length < 8) throw new Error("請填諮詢師帳號與至少 8 字元的新密碼");
    const db = supabaseAdmin();
    let query = db.from("users").update({
      password_hash: await hashPassword(password),
      updated_at: new Date().toISOString()
    }).eq("role", "consultant");
    query = id.includes("@") || id.length > 30 ? query.eq("id", id) : query.eq("username", id.toLowerCase());
    const user = assertDbOk(await query.select("id, username").single());
    json(res, 200, { ok: true, user, message: "密碼已重設" });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

