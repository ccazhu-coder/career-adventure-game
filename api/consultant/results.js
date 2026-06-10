import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["GET"])) return;

  try {
    const user = await requireUser(req, ["consultant", "owner"]);
    const db = supabaseAdmin();
    let query = db
      .from("results")
      .select("*, batches(batch_code, batch_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (user.role !== "owner") query = query.eq("consultant_id", user.id);
    const results = assertDbOk(await query);
    json(res, 200, { ok: true, results });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

