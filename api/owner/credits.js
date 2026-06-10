import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["POST"])) return;

  try {
    const owner = await requireUser(req, ["owner"]);
    const body = await readJson(req);
    const consultantId = String(body.consultantId || "").trim();
    const amount = Number(body.amount || 0);
    if (!consultantId) throw new Error("請選擇諮詢師");
    if (!Number.isFinite(amount) || amount === 0) throw new Error("額度不可為 0");
    const db = supabaseAdmin();
    const credit = assertDbOk(await db.from("consultant_credits").insert({
      consultant_id: consultantId,
      plan_id: body.planId || null,
      amount,
      reason: String(body.reason || "最高管理者調整額度").trim(),
      created_by: owner.id
    }).select("*").single());
    json(res, 200, { ok: true, credit });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

