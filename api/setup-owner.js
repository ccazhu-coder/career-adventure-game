import { assertDbOk, supabaseAdmin } from "../lib/db.js";
import { hashPassword } from "../lib/auth.js";
import { allowCors, json, method, readJson, safeMessage } from "../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["POST"])) return;

  try {
    const body = await readJson(req);
    const setupKey = process.env.SETUP_KEY;
    if (setupKey && body.setupKey !== setupKey) throw new Error("SETUP_KEY 不正確");

    const username = process.env.OWNER_USERNAME || "ccazhu";
    const password = process.env.OWNER_INITIAL_PASSWORD || body.password;
    if (!password) throw new Error("請先設定 OWNER_INITIAL_PASSWORD");

    const db = supabaseAdmin();
    const existing = assertDbOk(await db.from("users").select("id").eq("username", username).maybeSingle());
    const row = {
      username,
      email: body.email || "pucezhang@gmail.com",
      display_name: body.displayName || "知己知途最高管理者",
      password_hash: await hashPassword(password),
      role: "owner",
      status: "active",
      updated_at: new Date().toISOString()
    };
    const result = existing
      ? await db.from("users").update(row).eq("id", existing.id).select("id, username, role").single()
      : await db.from("users").insert(row).select("id, username, role").single();
    const owner = assertDbOk(result);

    const creditExists = assertDbOk(await db
      .from("consultant_credits")
      .select("id")
      .eq("consultant_id", owner.id)
      .eq("reason", "最高管理者初始營運額度")
      .maybeSingle());
    if (!creditExists) {
      assertDbOk(await db.from("consultant_credits").insert({
        consultant_id: owner.id,
        amount: 999999,
        reason: "最高管理者初始營運額度",
        created_by: owner.id
      }));
    }

    json(res, 200, { ok: true, user: owner });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}
