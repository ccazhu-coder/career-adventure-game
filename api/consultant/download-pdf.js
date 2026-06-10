import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, safeMessage } from "../../lib/http.js";
import { createSignedPdfUrl } from "../../lib/storage.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["GET"])) return;

  try {
    const user = await requireUser(req, ["consultant", "owner"]);
    const id = String(req.query?.id || "").trim();
    if (!id) throw new Error("缺少報告 ID");
    const db = supabaseAdmin();
    let query = db.from("results").select("id, consultant_id, pdf_storage_path").eq("id", id).single();
    const row = assertDbOk(await query);
    if (user.role !== "owner" && row.consultant_id !== user.id) throw new Error("權限不足");
    if (!row.pdf_storage_path) throw new Error("此紀錄尚未產生 PDF");
    const url = await createSignedPdfUrl(row.pdf_storage_path);
    res.statusCode = 302;
    res.setHeader("Location", url);
    res.end();
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

