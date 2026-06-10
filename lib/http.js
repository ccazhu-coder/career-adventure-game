export function allowCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.APP_ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function json(res, status, body) {
  res.status(status).json(body);
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  json(res, 405, { ok: false, message: "Method not allowed" });
  return false;
}

export function safeMessage(error) {
  return error?.message || "系統暫時無法處理，請稍後再試";
}

