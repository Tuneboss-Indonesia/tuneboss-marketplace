import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

process.env.XENDIT_SECRET_KEY = "test_xendit_key";

const [{ app }, { hashPassword }, { closeDb, db }, schema] = await Promise.all([
  import("./app.js"),
  import("./auth.js"),
  import("./db/client.js"),
  import("./db/schema.js"),
]);
const { addresses, orders, paymentEvents, productReviews, products, session, user: users } = schema;

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
    await db.delete(paymentEvents).where(sql`${paymentEvents.orderId} in (select id from orders where customer_id = ${userId})`);
    await db.delete(orders).where(eq(orders.customerId, userId));
    await db.delete(productReviews).where(eq(productReviews.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(users).where(eq(users.id, userId));
  };

  return { addressId, cleanup, cookie: `tuneboss_session=${token}`, productId };
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
