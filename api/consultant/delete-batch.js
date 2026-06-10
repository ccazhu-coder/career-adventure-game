import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["POST", "DELETE"])) return;

  try {
    const user = await requireUser(req, ["consultant", "owner"]);
    const body = req.method === "DELETE" ? req.query || {} : await readJson(req);
    const id = String(body.id || "").trim();
    if (!id) throw new Error("缺少批次 ID");
    const db = supabaseAdmin();
    let query = db.from("batches").update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (user.role !== "owner") query = query.eq("consultant_id", user.id);
    const batch = assertDbOk(await query);
    json(res, 200, { ok: true, batch });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

