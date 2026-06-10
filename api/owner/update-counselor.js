import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["PATCH"])) return;

  try {
    await requireUser(req, ["owner"]);
    const body = await readJson(req);
    const id = String(body.id || "").trim();
    if (!id) throw new Error("缺少諮詢師 ID");
    const update = {
      display_name: body.displayName,
      email: body.email,
      status: body.status,
      updated_at: new Date().toISOString()
    };
    Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);
    const db = supabaseAdmin();
    const counselor = assertDbOk(await db
      .from("users")
      .update(update)
      .eq("id", id)
      .eq("role", "consultant")
      .select("id, username, email, display_name, role, status")
      .single());
    json(res, 200, { ok: true, counselor });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

