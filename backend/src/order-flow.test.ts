import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

process.env.XENDIT_SECRET_KEY = "test_xendit_key";

const [{ app }, { hashPassword, verifyPassword }, { closeDb, db }, schema] = await Promise.all([
  import("./app.js"),
  import("./auth.js"),
  import("./db/client.js"),
  import("./db/schema.js"),
]);
const { addresses, adminAuditLogs, categories, emailVerificationTokens, orders, passwordResetTokens, paymentEvents, productImages, productReviews, products, session, user: users } = schema;

let server: Server;
let baseUrl = "";
const realFetch = globalThis.fetch;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address);
  assert.notEqual(typeof address, "string");
  const { port } = address as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await closeDb();
});

async function fixture(stock = 5, role: "admin" | "customer" = "customer") {
  const id = randomUUID();
  const userId = `test-${id}`;
  const token = `token-${id}`;
  const productId = randomUUID();
  const addressId = randomUUID();

  await db.insert(users).values({
    email: `${id}@example.test`,
    emailVerified: true,
    id: userId,
    name: "Test Customer",
    passwordHash: hashPassword("password123"),
    role,
  });
  await db.insert(session).values({
    expiresAt: new Date(Date.now() + 60_000),
    id: `session-${id}`,
    token,
    userId,
  });
  await db.insert(addresses).values({
    addressLine: "Jl. Test No. 1",
    customerId: userId,
    id: addressId,
    phone: "081234567890",
    recipientName: "Test Customer",
  });
  await db.insert(products).values({
    id: productId,
    name: "Test ECU",
    price: "100000.00",
    sku: `SKU-${id}`,
    stock,
  });

  const cleanup = async () => {
    await db.delete(adminAuditLogs).where(eq(adminAuditLogs.actorId, userId));
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(paymentEvents).where(sql`${paymentEvents.orderId} in (select id from orders where customer_id = ${userId})`);
    await db.delete(orders).where(eq(orders.customerId, userId));
    await db.delete(productReviews).where(eq(productReviews.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(users).where(eq(users.id, userId));
  };

  return { addressId, cleanup, cookie: `tuneboss_session=${token}`, productId, userId };
}

async function post(path: string, cookie: string, body: unknown) {
  const response = await postRaw(path, cookie, body);
  const json = await response.json() as { order?: { id: string }; message?: string };
  assert.equal(response.ok, true, json.message ?? response.statusText);
  return json;
}

async function postRaw(path: string, cookie: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Cookie: cookie },
    method: "POST",
  });
  return response;
}

async function patchRaw(path: string, cookie: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Cookie: cookie },
    method: "PATCH",
  });
  return response;
}

async function stockOf(productId: string) {
  const [product] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, productId));
  assert.ok(product);
  return product.stock;
}

test("readiness endpoint checks database", async () => {
  const response = await fetch(`${baseUrl}/api/ready`);
  const body = await response.json() as { database: string; ok: boolean };

  assert.equal(response.status, 200);
  assert.deepEqual(body, { database: "ok", ok: true, service: "tuneboss-marketplace-api" });
});

test("auth register is rate limited", async () => {
  let last = new Response(null, { status: 500 });
  for (let i = 0; i < 11; i += 1) {
    last = await postRaw("/api/auth/register", "", { email: "bad", password: "short" });
  }

  assert.equal(last.status, 429);
});

test("categories endpoint returns public category slugs", async () => {
  const id = randomUUID();
  try {
    await db.insert(categories).values({ description: "Kategori ECU racing", id, name: `ECU Racing ${id.slice(0, 8)}` });

    const response = await fetch(`${baseUrl}/api/categories`);
    const body = await response.json() as { categories: Array<{ id: string; slug: string }> };

    assert.equal(response.status, 200);
    assert.ok(body.categories.some((category) => category.id === id && category.slug.startsWith("ecu-racing-")));
  } finally {
    await db.delete(categories).where(eq(categories.id, id));
  }
});

test("admin product images appear on public product detail", async () => {
  const fx = await fixture(5, "admin");
  try {
    const images = ["https://example.com/one.png", "https://example.com/two.png"];
    const updated = await patchRaw(`/api/admin/products/${fx.productId}`, fx.cookie, { images });
    assert.equal(updated.status, 200);

    const response = await fetch(`${baseUrl}/api/products/${fx.productId}`);
    const body = await response.json() as { product: { images: string[] } };

    assert.equal(response.status, 200);
    assert.deepEqual(body.product.images, images);
  } finally {
    await db.delete(productImages).where(eq(productImages.productId, fx.productId));
    await fx.cleanup();
  }
});

test("admin login uses shorter session expiry", async () => {
  const fx = await fixture(5, "admin");
  try {
    const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, fx.userId));
    assert.ok(account);

    const response = await postRaw("/api/auth/login", "", { email: account.email, password: "password123" });
    assert.equal(response.status, 200);

    const rows = await db.select({ expiresAt: session.expiresAt }).from(session).where(eq(session.userId, fx.userId));
    const longestMs = Math.max(...rows.map((row) => row.expiresAt.getTime() - Date.now()));
    assert.ok(longestMs > 11 * 60 * 60 * 1000);
    assert.ok(longestMs < 13 * 60 * 60 * 1000);
  } finally {
    await fx.cleanup();
  }
});

test("product reviews are returned by product slug", async () => {
  const f = await fixture();
  try {
    await db.insert(productReviews).values({ authorName: "Reviewer", productId: f.productId, quote: "Respons gas lebih halus setelah dipasang.", rating: 4 });

    const response = await fetch(`${baseUrl}/api/products/test-ecu/reviews`);
    const body = await response.json() as { averageRating: number; reviews: Array<{ authorName: string; quote: string; rating: number }>; total: number };

    assert.equal(response.status, 200);
    assert.equal(body.total, 1);
    assert.equal(body.averageRating, 4);
    assert.equal(body.reviews[0]?.authorName, "Reviewer");
  } finally {
    await f.cleanup();
  }
});

test("customer can review only fulfilled purchased products once", async () => {
  const f = await fixture();
  try {
    const blocked = await postRaw(`/api/products/${f.productId}/reviews`, f.cookie, { quote: "Belum selesai tapi ingin review.", rating: 5 });
    assert.equal(blocked.status, 403);

    const created = await post("/api/orders", f.cookie, { addressId: f.addressId, items: [{ id: f.productId, quantity: 1 }] });
    await db.update(orders).set({ status: "fulfilled" }).where(eq(orders.id, created.order?.id ?? ""));

    const accepted = await postRaw(`/api/products/${f.productId}/reviews`, f.cookie, { quote: "Produk sudah dipakai dan hasilnya terasa enak.", rating: 5 });
    assert.equal(accepted.status, 201);

    const duplicate = await postRaw(`/api/products/${f.productId}/reviews`, f.cookie, { quote: "Review kedua harus ditolak.", rating: 4 });
    assert.equal(duplicate.status, 409);
  } finally {
    await f.cleanup();
  }
});

test("forgot password emails otp and resets password", async () => {
  const fx = await fixture();
  let otp = "";

  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "TuneBoss <noreply@example.com>";
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://api.resend.com/emails") {
      const body = init?.body ? JSON.parse(String(init.body)) as { html?: string } : {};
      otp = body.html?.match(/\b\d{6}\b/)?.[0] ?? "";
      return new Response(JSON.stringify({ id: "email-test" }), { status: 200 });
    }
    return realFetch(input, init);
  };

  try {
    const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, fx.userId));
    assert.ok(account);

    assert.equal((await postRaw("/api/auth/forgot-password", "", { email: account.email })).status, 200);
    assert.match(otp, /^\d{6}$/);
    assert.equal((await postRaw("/api/auth/forgot-password/verify", "", { email: account.email, otp })).status, 200);
    assert.equal((await postRaw("/api/auth/reset-password", "", { email: account.email, otp, password: "newpass123" })).status, 200);

    const [updated] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, fx.userId));
    assert.ok(updated);
    assert.equal(verifyPassword("newpass123", updated.passwordHash), true);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    await fx.cleanup();
  }
});

test("email verification emails otp and marks account verified", async () => {
  const fx = await fixture();
  let otp = "";

  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "TuneBoss <noreply@example.com>";
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://api.resend.com/emails") {
      const body = init?.body ? JSON.parse(String(init.body)) as { html?: string } : {};
      otp = body.html?.match(/\b\d{6}\b/)?.[0] ?? "";
      return new Response(JSON.stringify({ id: "email-test" }), { status: 200 });
    }
    return realFetch(input, init);
  };

  try {
    await db.update(users).set({ emailVerified: false }).where(eq(users.id, fx.userId));
    const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, fx.userId));
    assert.ok(account);

    assert.equal((await postRaw("/api/auth/email-verification/request", "", { email: account.email })).status, 200);
    assert.match(otp, /^\d{6}$/);
    assert.equal((await postRaw("/api/auth/email-verification/verify", "", { email: account.email, otp })).status, 200);

    const [verified] = await db.select({ emailVerified: users.emailVerified }).from(users).where(eq(users.id, fx.userId));
    assert.equal(verified?.emailVerified, true);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    await fx.cleanup();
  }
});

test("checkout requires verified email", async () => {
  const fx = await fixture();
  try {
    await db.update(users).set({ emailVerified: false }).where(eq(users.id, fx.userId));

    const response = await postRaw("/api/orders", fx.cookie, { addressId: fx.addressId, items: [{ id: fx.productId, quantity: 1 }] });
    const body = await response.json() as { message: string };

    assert.equal(response.status, 403);
    assert.match(body.message, /Verifikasi email/);
  } finally {
    await fx.cleanup();
  }
});

test("shipping quote and order total include backend shipping cost", async () => {
  const fx = await fixture(5);
  try {
    const quoteResponse = await postRaw("/api/shipping/quote", fx.cookie, { addressId: fx.addressId, items: [{ id: fx.productId, quantity: 1 }] });
    const quoteBody = await quoteResponse.json() as { quote: { cost: number; method: string; subtotal: number; total: number } };

    assert.equal(quoteResponse.status, 200);
    assert.deepEqual(quoteBody.quote, { cost: 25000, method: "REGULAR", subtotal: 100000, total: 125000, label: "Regular" });

    const orderResponse = await postRaw("/api/orders", fx.cookie, { addressId: fx.addressId, items: [{ id: fx.productId, quantity: 1 }], shippingMethod: "REGULAR" });
    const orderBody = await orderResponse.json() as { order: { shippingCost: number; total: number } };

    assert.equal(orderResponse.status, 201);
    assert.equal(orderBody.order.shippingCost, 25000);
    assert.equal(orderBody.order.total, 125000);
  } finally {
    await fx.cleanup();
  }
});

test("checkout reserves stock and customer cancel restores it", async () => {
  const fx = await fixture(5);
  try {
    const created = await post("/api/orders", fx.cookie, { addressId: fx.addressId, items: [{ id: fx.productId, quantity: 2 }] });
    assert.equal(await stockOf(fx.productId), 3);

    const cancelled = await post(`/api/orders/${created.order?.id}/cancel`, fx.cookie, {});
    assert.equal(cancelled.order?.id, created.order?.id);
    assert.equal(await stockOf(fx.productId), 5);
  } finally {
    await fx.cleanup();
  }
});

test("duplicate paid webhook does not reduce reserved stock twice", async () => {
  const fx = await fixture(5);
  try {
    const created = await post("/api/orders", fx.cookie, { addressId: fx.addressId, items: [{ id: fx.productId, quantity: 2 }] });
    assert.equal(await stockOf(fx.productId), 3);

    const providerReference = `webhook-${created.order?.id}`;
    const payload = { external_id: created.order?.id, id: providerReference, status: "PAID" };
    await post("/api/webhooks/xendit", "", payload);
    await post("/api/webhooks/xendit", "", payload);

    assert.equal(await stockOf(fx.productId), 3);
    const [order] = await db.select().from(orders).where(and(eq(orders.id, created.order?.id ?? ""), eq(orders.status, "paid")));
    assert.ok(order);
    assert.equal(order.stockReserved, false);
    const [{ totalEvents }] = await db
      .select({ totalEvents: sql<number>`count(*)` })
      .from(paymentEvents)
      .where(eq(paymentEvents.providerReference, providerReference));
    assert.equal(Number(totalEvents), 1);
  } finally {
    await fx.cleanup();
  }
});

test("parallel invoice creation claims one request", async () => {
  const fx = await fixture(5);
  let xenditCalls = 0;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://api.xendit.co/v2/invoices") {
      xenditCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return new Response(JSON.stringify({ id: "invoice-test", invoice_url: "https://pay.example.test/invoice-test", status: "PENDING" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }
    return realFetch(input, init);
  };

  try {
    const created = await post("/api/orders", fx.cookie, { addressId: fx.addressId, items: [{ id: fx.productId, quantity: 1 }] });
    const responses = await Promise.all([
      postRaw("/api/payments/xendit/invoice", fx.cookie, { orderId: created.order?.id }),
      postRaw("/api/payments/xendit/invoice", fx.cookie, { orderId: created.order?.id }),
    ]);

    assert.equal(responses.filter((response) => response.status === 200).length >= 1, true);
    assert.equal(responses.every((response) => response.status === 200 || response.status === 409), true);
    assert.equal(xenditCalls, 1);
  } finally {
    globalThis.fetch = realFetch;
    await fx.cleanup();
  }
});

test("admin status guard blocks reopening cancelled orders", async () => {
  const fx = await fixture(5, "admin");
  try {
    const created = await post("/api/orders", fx.cookie, { addressId: fx.addressId, items: [{ id: fx.productId, quantity: 1 }] });
    await post(`/api/orders/${created.order?.id}/cancel`, fx.cookie, {});

    const response = await patchRaw(`/api/admin/orders/${created.order?.id}/status`, fx.cookie, { status: "paid" });
    const body = await response.json() as { message: string };

    assert.equal(response.status, 400);
    assert.match(body.message, /tidak dapat diubah/);
  } finally {
    await fx.cleanup();
  }
});

test("admin product stock updates are audited", async () => {
  const fx = await fixture(5, "admin");
  try {
    const response = await patchRaw(`/api/admin/products/${fx.productId}/stock`, fx.cookie, { note: "Audit test", stock: 7 });
    assert.equal(response.status, 200);

    const [log] = await db
      .select()
      .from(adminAuditLogs)
      .where(and(eq(adminAuditLogs.actorId, fx.userId), eq(adminAuditLogs.targetId, fx.productId), eq(adminAuditLogs.action, "products.stock_update")))
      .limit(1);

    assert.ok(log);
    assert.equal(log.targetType, "product");
  } finally {
    await fx.cleanup();
  }
});

test("fulfillment sends shipped and delivered emails once", async () => {
  const fx = await fixture(5, "admin");
  const calls: unknown[] = [];

  try {
    const created = await post("/api/orders", fx.cookie, { addressId: fx.addressId, items: [{ id: fx.productId, quantity: 1 }] });
    await post("/api/webhooks/xendit", "", { external_id: created.order?.id, id: `paid-${created.order?.id}`, status: "PAID" });

    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "TuneBoss <noreply@example.com>";
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "https://api.resend.com/emails") {
        calls.push(init?.body ? JSON.parse(String(init.body)) : null);
        return new Response(JSON.stringify({ id: "email-test" }), { status: 200 });
      }
      return realFetch(input, init);
    };

    const shippedAt = new Date().toISOString();
    assert.equal((await patchRaw(`/api/admin/orders/${created.order?.id}/fulfillment`, fx.cookie, { courier: "JNE", shippedAt, trackingNumber: "TRACK1" })).status, 200);
    assert.equal((await patchRaw(`/api/admin/orders/${created.order?.id}/fulfillment`, fx.cookie, { trackingNumber: "TRACK2" })).status, 200);
    assert.equal((await patchRaw(`/api/admin/orders/${created.order?.id}/fulfillment`, fx.cookie, { deliveredAt: new Date().toISOString() })).status, 200);

    assert.equal(calls.length, 2);
    assert.match(JSON.stringify(calls[0]), /dikirim|Order Shipped/i);
    assert.match(JSON.stringify(calls[1]), /diterima|Order Delivered/i);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    await fx.cleanup();
  }
});
