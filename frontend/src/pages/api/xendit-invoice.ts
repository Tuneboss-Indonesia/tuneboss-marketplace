import type { APIRoute } from 'astro';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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

    const apiKey = import.meta.env.XENDIT_SECRET_KEY || process.env.XENDIT_SECRET_KEY;

    if (!apiKey || apiKey === "YOUR_XENDIT_SECRET_KEY_HERE") {
      return json({ error: "XENDIT_SECRET_KEY belum dikonfigurasi di environment production." }, 500);
    }

    if (!amount) {
      return json({ error: "Total pembayaran (amount) tidak valid" }, 400);
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

    const xenditText = await xenditRes.text();
    const xenditData = xenditText ? JSON.parse(xenditText) : {};

    if (!xenditRes.ok) {
      console.error("Xendit Error:", xenditData);
      return json({ error: xenditData.message || xenditData.error_code || "Gagal membuat tagihan Xendit" }, xenditRes.status);
    }

    return json({ 
      invoice_url: xenditData.invoice_url,
      id: xenditData.id
    });

  } catch (error: unknown) {
    console.error("Xendit Invoice API Error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return json({ error: msg }, 500);
  }
}
