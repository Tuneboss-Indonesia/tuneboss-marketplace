import type { APIRoute } from 'astro';
import { loadEnv } from 'vite';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { 
      externalId = `order-${Date.now()}`, 
      amount, 
      payerEmail, 
      description,
      items,
      customer
    } = body;

    const env = loadEnv(import.meta.env.MODE, process.cwd(), "");
    const apiKey = env.XENDIT_SECRET_KEY || import.meta.env.XENDIT_SECRET_KEY || process.env.XENDIT_SECRET_KEY;

    if (!apiKey || apiKey === "YOUR_XENDIT_SECRET_KEY_HERE") {
      return new Response(JSON.stringify({ error: "API Key Xendit belum dikonfigurasi di file .env" }), { status: 500 });
    }

    if (!amount) {
      return new Response(JSON.stringify({ error: "Total pembayaran (amount) tidak valid" }), { status: 400 });
    }

    // Xendit uses Basic Auth with the Secret Key as the username, and an empty password
    const encodedKey = Buffer.from(apiKey + ':').toString('base64');

    const url = new URL(request.url);
    const origin = url.origin;
    const redirectUrl = `${origin}/checkout/${externalId}`;

    const invoicePayload = {
      external_id: externalId,
      amount: amount,
      payer_email: payerEmail || 'guest@tuneboss.com',
      description: description || 'Pembayaran Pesanan TuneBoss',
      invoice_duration: 86400, // 24 hours
      currency: "IDR",
      success_redirect_url: `${redirectUrl}?status=success`,
      failure_redirect_url: `${redirectUrl}?status=failed`,
      items: items || [],
      customer: customer || {}
    };

    const xenditRes = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${encodedKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(invoicePayload)
    });

    const xenditData = await xenditRes.json();

    if (!xenditRes.ok) {
      console.error("Xendit Error:", xenditData);
      return new Response(JSON.stringify({ error: xenditData.message || "Gagal membuat tagihan Xendit" }), { status: xenditRes.status });
    }

    return new Response(JSON.stringify({ 
      invoice_url: xenditData.invoice_url,
      id: xenditData.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    console.error("Xendit Invoice API Error:", error);
    const msg = error instanceof Error ? (error.stack || error.message) : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
