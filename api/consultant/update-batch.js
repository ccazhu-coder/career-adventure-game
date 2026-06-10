import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";
import { isEmail } from "../../lib/validation.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["PATCH"])) return;

  try {
    const user = await requireUser(req, ["consultant", "owner"]);
    const body = await readJson(req);
    const id = String(body.id || "").trim();
    if (!id) throw new Error("缺少批次 ID");
    if (body.counselorEmail && !isEmail(body.counselorEmail)) throw new Error("請輸入有效的諮詢師 Email");

    const db = supabaseAdmin();
    const update = {
      batch_name: body.batchName,
      quantity: body.quantity === undefined ? undefined : Number(body.quantity),
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      counselor_email: body.counselorEmail,
      status: body.status,
      updated_at: new Date().toISOString()
    };
    Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);

    let query = db.from("batches").update(update).eq("id", id).select("*").single();
    if (user.role !== "owner") query = query.eq("consultant_id", user.id);
    const batch = assertDbOk(await query);
    json(res, 200, { ok: true, batch });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

