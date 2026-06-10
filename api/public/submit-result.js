import { assertDbOk, supabaseAdmin } from "../../lib/db.js";
import { allowCors, json, method, readJson, safeMessage } from "../../lib/http.js";
import { sendReportEmail } from "../../lib/mail.js";
import { createSignedPdfUrl, uploadPdf, uploadText } from "../../lib/storage.js";
import { isEmail, normalizeShortCode } from "../../lib/validation.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!method(req, res, ["POST"])) return;

  try {
    const body = await readJson(req);
    const shortCode = normalizeShortCode(body.shortCode || body.batchShortCode || body.accessInfo?.shortCode);
    if (!shortCode) throw new Error("缺少任務短碼");
    if (!isEmail(body.email)) throw new Error("請填寫有效的 Email");
    if (!body.pdfBase64) throw new Error("缺少 PDF 報告檔案");

    const db = supabaseAdmin();
    const batch = assertDbOk(await db
      .from("batches")
      .select("id, short_code, counselor_email")
      .eq("short_code", shortCode)
      .eq("status", "active")
      .maybeSingle());
    if (!batch) throw new Error("此任務短碼不存在或未啟用");

    const record = body.record || {};
    const rawAnswers = body.rawAnswers || record["原始答案JSON"] || {};
    const rawJson = typeof rawAnswers === "string" ? JSON.parse(rawAnswers || "{}") : rawAnswers;

    const resultRows = assertDbOk(await db.rpc("consume_credit_for_result", {
      p_batch_id: batch.id,
      p_short_code: shortCode,
      p_student_name: String(body.name || record["姓名/暱稱"] || "學員").trim(),
      p_student_email: String(body.email).trim().toLowerCase(),
      p_gender: record["性別"] || body.gender || "",
      p_age: record["年齡"] || body.age || "",
      p_phone: record["電話"] || body.phone || "",
      p_holland_code: body.hollandCode || record["荷倫代碼"] || "",
      p_top_riasec: body.topRiasec || [],
      p_value_scores: body.valueScores || {},
      p_holland_scores: body.hollandScores || {},
      p_raw_answers: rawJson,
      p_counselor_advice: String(body.counselorReportText || record["諮詢師專業建議"] || ""),
      p_completion_rate: Number(record["完成率"] || body.completionRate || 100)
    }));

    const result = Array.isArray(resultRows) ? resultRows[0] : resultRows;
    if (!result?.result_id) throw new Error("測驗結果建立失敗");

    const date = new Date().toISOString().slice(0, 10);
    const safeName = String(body.name || "student").replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40);
    const pdfPath = `students/${date}/${result.result_id}_${safeName}.pdf`;
    const counselorPath = `counselors/${date}/${result.result_id}_${safeName}.txt`;

    await uploadPdf(pdfPath, body.pdfBase64);
    if (body.counselorReportText) await uploadText(counselorPath, body.counselorReportText);

    assertDbOk(await db
      .from("results")
      .update({
        pdf_storage_path: pdfPath,
        counselor_report_storage_path: body.counselorReportText ? counselorPath : null
      })
      .eq("id", result.result_id));

    const pdfUrl = await createSignedPdfUrl(pdfPath);
    const emailResult = await sendEmailsOnce({
      db,
      resultId: result.result_id,
      studentEmail: body.email,
      counselorEmail: batch.counselor_email,
      studentName: body.name || "學員",
      pdfBase64: body.pdfBase64,
      fileName: body.fileName || "career-report.pdf",
      counselorReportText: body.counselorReportText || ""
    });

    json(res, 200, {
      ok: true,
      resultId: result.result_id,
      pdfUrl,
      email: emailResult
    });
  } catch (error) {
    json(res, 400, { ok: false, message: safeMessage(error) });
  }
}

async function sendEmailsOnce({ db, resultId, studentEmail, counselorEmail, studentName, pdfBase64, fileName, counselorReportText }) {
  const attachment = {
    filename: fileName,
    content: String(pdfBase64).replace(/^data:application\/pdf;base64,/, "")
  };
  const outcomes = {};

  outcomes.student = await sendOne({
    db,
    resultId,
    recipientType: "student",
    to: studentEmail,
    subject: "知己知途｜你的職涯探索冒險 PDF 報告",
    html: `<p>${studentName} 您好，附件是你的職涯探索冒險 PDF 報告。</p>`,
    attachments: [attachment]
  });

  if (isEmail(counselorEmail)) {
    outcomes.consultant = await sendOne({
      db,
      resultId,
      recipientType: "consultant",
      to: counselorEmail,
      subject: `知己知途｜${studentName} 的職涯探索個案報告`,
      html: `<p>附件為 ${studentName} 的 PDF 報告。</p><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(counselorReportText)}</pre>`,
      attachments: [attachment]
    });
  }
  return outcomes;
}

async function sendOne({ db, resultId, recipientType, to, subject, html, attachments }) {
  const existing = assertDbOk(await db
    .from("email_logs")
    .select("id, status")
    .eq("result_id", resultId)
    .eq("recipient_type", recipientType)
    .maybeSingle());

  if (existing?.status === "sent") return { status: "skipped", message: "already sent" };

  try {
    const sent = await sendReportEmail({ to, subject, html, attachments });
    await db.from("email_logs").upsert({
      result_id: resultId,
      recipient_email: to,
      recipient_type: recipientType,
      status: "sent",
      provider_message_id: sent?.data?.id || "",
      error_message: "",
      sent_at: new Date().toISOString()
    }, { onConflict: "result_id,recipient_type" });
    return { status: "sent" };
  } catch (error) {
    await db.from("email_logs").upsert({
      result_id: resultId,
      recipient_email: to,
      recipient_type: recipientType,
      status: "failed",
      error_message: safeMessage(error)
    }, { onConflict: "result_id,recipient_type" });
    return { status: "failed", message: safeMessage(error) };
  }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[char]);
}

