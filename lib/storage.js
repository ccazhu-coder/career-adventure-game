import { assertDbOk, supabaseAdmin } from "./db.js";

export async function uploadPdf(path, base64Pdf) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "career-reports";
  const cleanBase64 = String(base64Pdf || "").replace(/^data:application\/pdf;base64,/, "");
  if (!cleanBase64) throw new Error("缺少 PDF 檔案");
  const buffer = Buffer.from(cleanBase64, "base64");
  const db = supabaseAdmin();
  assertDbOk(await db.storage.from(bucket).upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true
  }), "PDF 上傳失敗");
  return path;
}

export async function uploadText(path, text, contentType = "text/plain; charset=utf-8") {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "career-reports";
  const db = supabaseAdmin();
  assertDbOk(await db.storage.from(bucket).upload(path, Buffer.from(String(text || ""), "utf8"), {
    contentType,
    upsert: true
  }), "文字報告上傳失敗");
  return path;
}

export async function createSignedPdfUrl(path) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "career-reports";
  const db = supabaseAdmin();
  const result = await db.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (result.error) throw new Error(result.error.message || "PDF 下載連結產生失敗");
  return result.data.signedUrl;
}
