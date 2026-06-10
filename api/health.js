import { allowCors, json } from "../lib/http.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  json(res, 200, {
    ok: true,
    service: "career-adventure-api",
    google: false
  });
}

