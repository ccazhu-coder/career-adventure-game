import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;

  try {
    await requireUser(req, ["owner"]);
    if (req.method === "GET") return list(res);
    if (req.method === "POST") return save(req, res);
    if (!method(req, res, ["GET", "POST"])) return;
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

async function list(res) {
  const db = supabaseAdmin();
  const plans = assertDbOk(await db.from("license_plans").select("*").order("created_at", { ascending: false }));
  json(res, 200, { ok: true, plans });
}

async function save(req, res) {
  const body = await readJson(req);
  const db = supabaseAdmin();
  const row = {
    name: String(body.name || body.planName || "").trim(),
    price_cents: Math.round(Number(body.price || body.amount || 0) * 100),
    test_quantity: Number(body.quantity || body.testQuantity || 1),
    status: body.status === "disabled" || body.status === "停用" ? "disabled" : "active",
    note: String(body.note || "").trim()
  };
  if (!row.name) throw new Error("請填方案名稱");
  const result = body.id
    ? await db.from("license_plans").update(row).eq("id", body.id).select("*").single()
    : await db.from("license_plans").insert(row).select("*").single();
  json(res, 200, { ok: true, plan: assertDbOk(result) });
}

