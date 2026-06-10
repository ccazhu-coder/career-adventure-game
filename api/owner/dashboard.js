import { requireUser } from "../../lib/auth.js";
import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, safeMessage } from "../../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["GET"])) return;

  try {
    await requireUser(req, ["owner"]);
    const db = supabaseAdmin();
    const [users, batches, results] = await Promise.all([
      db.from("users").select("id", { count: "exact", head: true }).eq("role", "consultant"),
      db.from("batches").select("id", { count: "exact", head: true }).neq("status", "deleted"),
      db.from("results").select("id", { count: "exact", head: true })
    ]);
    assertDbOk(users);
    assertDbOk(batches);
    assertDbOk(results);
    json(res, 200, {
      ok: true,
      summary: {
        consultants: users.count || 0,
        batches: batches.count || 0,
        results: results.count || 0
      }
    });
  } catch (error) {
    json(res, 403, { ok: false, message: safeMessage(error) });
  }
}

