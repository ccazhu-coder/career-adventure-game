import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";
import { normalizeShortCode } from "../../lib/validation.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["POST"])) return;

  try {
    const body = await readJson(req);
    const shortCode = normalizeShortCode(body.code || body.shortCode || body.c);
    if (!shortCode) throw new Error("請輸入任務短碼");

    const db = supabaseAdmin();
    const batch = assertDbOk(await db
      .from("batches")
      .select("id, batch_code, batch_name, short_code, quantity, completed_count, starts_at, ends_at, status, consultant_id")
      .eq("short_code", shortCode)
      .maybeSingle());

    if (!batch) throw new Error("查無此任務短碼");
    if (batch.status !== "active") throw new Error("此任務短碼目前未啟用");

    const consultant = assertDbOk(await db
      .from("users")
      .select("id, status")
      .eq("id", batch.consultant_id)
      .maybeSingle());
    if (!consultant || consultant.status !== "active") throw new Error("此諮詢師帳號目前未啟用");

    const now = Date.now();
    if (new Date(batch.starts_at).getTime() > now) throw new Error("此任務尚未開始");
    if (new Date(batch.ends_at).getTime() < now) throw new Error("此任務已結束");
    if (Number(batch.completed_count) >= Number(batch.quantity)) throw new Error("此批次名額已滿");

    json(res, 200, {
      ok: true,
      batch: {
        id: batch.id,
        batchCode: batch.batch_code,
        batchName: batch.batch_name,
        shortCode: batch.short_code,
        quantity: batch.quantity,
        completedCount: batch.completed_count,
        remainingSeats: Number(batch.quantity) - Number(batch.completed_count),
        validUntil: batch.ends_at
      }
    });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}
