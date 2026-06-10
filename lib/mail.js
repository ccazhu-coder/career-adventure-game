import { Resend } from "resend";

let resend;

function mailer() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY 尚未設定");
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendReportEmail({ to, subject, html, attachments = [] }) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM 尚未設定");
  return mailer().emails.send({ from, to, subject, html, attachments });
}

