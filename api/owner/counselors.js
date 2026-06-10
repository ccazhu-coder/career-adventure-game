import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["GET"])) return;

  try {
    await requireUser(req, ["owner"]);
    const db = supabaseAdmin();
    const counselors = assertDbOk(await db
      .from("users")
      .select("id, username, email, display_name, role, status, created_at")
      .eq("role", "consultant")
      .order("created_at", { ascending: false }));
    const credits = assertDbOk(await db
      .from("consultant_credits")
      .select("consultant_id, amount"));
    const balance = new Map();
    credits.forEach((row) => balance.set(row.consultant_id, (balance.get(row.consultant_id) || 0) + Number(row.amount || 0)));
    json(res, 200, {
      ok: true,
      counselors: counselors.map((row) => ({ ...row, creditBalance: balance.get(row.id) || 0 }))
    });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

