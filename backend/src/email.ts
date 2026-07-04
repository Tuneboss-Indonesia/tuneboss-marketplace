import { env } from "./env.js";

export async function sendEmail(input: { html: string; subject: string; to: string }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { skipped: true };

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({ from: env.EMAIL_FROM, html: input.html, subject: input.subject, to: input.to }),
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) throw new Error(`Resend email failed: ${response.status}`);
  return { skipped: false };
}
