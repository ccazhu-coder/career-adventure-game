import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";
import { generateShortCode, isEmail, requireFields } from "../../lib/validation.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;

  try {
    const user = await requireUser(req, ["consultant", "owner"]);
    if (req.method === "GET") return listBatches(res, user);
    if (req.method === "POST") return createBatch(req, res, user);
    if (!method(req, res, ["GET", "POST"])) return;
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

async function listBatches(res, user) {
  const db = supabaseAdmin();
  let query = db.from("batches").select("*").neq("status", "deleted").order("created_at", { ascending: false });
  if (user.role !== "owner") query = query.eq("consultant_id", user.id);
  const batches = assertDbOk(await query);
  json(res, 200, { ok: true, batches });
}

async function createBatch(req, res, user) {
  const body = await readJson(req);
  requireFields(body, ["batchCode", "batchName", "quantity", "startsAt", "endsAt", "counselorEmail"]);
  if (!isEmail(body.counselorEmail)) throw new Error("請輸入有效的諮詢師 Email");

  const db = supabaseAdmin();
  const creditRows = assertDbOk(await db
    .from("consultant_credits")
    .select("amount")
    .eq("consultant_id", user.id));
  const balance = creditRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  if (balance <= 0) throw new Error("目前沒有可用施測額度，請聯絡管理者開通");

  let shortCode = "";
  for (let i = 0; i < 8; i += 1) {
    shortCode = generateShortCode();
    const exists = assertDbOk(await db.from("batches").select("id").eq("short_code", shortCode).maybeSingle());
    if (!exists) break;
  }
  if (!shortCode) throw new Error("短碼產生失敗，請再試一次");

  const row = {
    consultant_id: user.id,
    batch_code: String(body.batchCode).trim(),
    batch_name: String(body.batchName).trim(),
    short_code: shortCode,
    quantity: Number(body.quantity),
    starts_at: body.startsAt,
    ends_at: body.endsAt,
    counselor_email: String(body.counselorEmail).trim(),
    status: body.status === "stopped" ? "stopped" : "active"
  };

  const batch = assertDbOk(await db.from("batches").insert(row).select("*").single());
  json(res, 200, {
    ok: true,
    batch: {
      ...batch,
      link: `${process.env.APP_BASE_URL || ""}/?c=${batch.short_code}`
    }
  });
}
