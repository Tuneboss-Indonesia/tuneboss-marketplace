import { env } from "./env.js";

export async function sendEmail(input: { html: string; subject: string; to: string }) {
  const apiKey = process.env.RESEND_API_KEY ?? env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? env.EMAIL_FROM;
  if (!apiKey || !from) return { skipped: true };

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({ from, html: input.html, subject: input.subject, to: input.to }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) throw new Error(`Resend email failed: ${response.status}`);
  return { skipped: false };
}
