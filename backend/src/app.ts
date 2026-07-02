import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { currentUser, hashPassword, login, logout, me, register, verifyPassword } from "./auth.js";
import { db } from "./db/client.js";
import { addresses, orderItems, orders, products, stockMovements, user as users } from "./db/schema.js";
import { env } from "./env.js";

export const app = express();

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/&/g, "and")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const formatRupiah = (value: string) => `Rp. ${new Intl.NumberFormat("id-ID").format(Number(value))}`;

const brandFrom = (name: string, sku: string) => ["Honda", "Yamaha", "Kawasaki", "Suzuki"]
  .find((brand) => `${sku} ${name}`.toLowerCase().includes(brand.toLowerCase())) ?? "TuneBoss";

function productDto(product: typeof products.$inferSelect) {
  return {
    brand: brandFrom(product.name, product.sku),
    description: product.description,
    id: product.id,
    image: product.imageUrl ?? "/images/tuneboss-motorcycle-ecu.png",
    imageUrl: product.imageUrl,
    name: product.name,
    price: formatRupiah(product.price),
    priceValue: Number(product.price),
    sku: product.sku,
    slug: slugify(product.name),
    stock: product.stock,
  };
}

const orderSchema = z.object({
  addressId: z.string().uuid(),
  items: z.array(z.object({
    id: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
  })).min(1),
});

const invoiceSchema = z.object({
  orderId: z.string().uuid(),
});

const addressSchema = z.object({
  addressLine: z.string().trim().min(5),
  city: z.string().trim().optional().default(""),
  isDefault: z.boolean().optional().default(false),
  label: z.string().trim().optional().default("Rumah"),
  phone: z.string().trim().min(8),
  postalCode: z.string().trim().optional().default(""),
  province: z.string().trim().optional().default(""),
  recipientName: z.string().trim().min(3),
});

const addressPatchSchema = addressSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Minimal satu field harus diisi.",
});

const profileSchema = z.object({
  name: z.string().trim().min(3),
  phone: z.string().trim().optional().default(""),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const adminOrderStatusSchema = z.object({
  status: z.enum(["draft", "pending", "paid", "cancelled", "fulfilled"]),
});

const xenditWebhookSchema = z.object({
  external_id: z.string().uuid(),
  status: z.string(),
}).passthrough();

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function requireStaff(req: Request, res: Response) {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ message: "Silakan login." });
    return null;
  }
  if (user.role !== "admin" && user.role !== "staff") {
    res.status(403).json({ message: "Akses admin diperlukan." });
    return null;
  }
  return user;
}

async function orderDetail(order: typeof orders.$inferSelect) {
  const items = await db
    .select({
      id: products.id,
      name: products.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.id));

  const [customer] = order.customerId
    ? await db.select({ email: users.email, id: users.id, name: users.name, phone: users.phone }).from(users).where(eq(users.id, order.customerId)).limit(1)
    : [];
  const [address] = order.addressId
    ? await db.select().from(addresses).where(eq(addresses.id, order.addressId)).limit(1)
    : [];

  return {
    address: address ?? null,
    addressId: order.addressId,
    createdAt: order.createdAt,
    customer: customer ?? null,
    customerId: order.customerId,
    id: order.id,
    items: items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
    status: order.status,
    total: Number(order.total),
    updatedAt: order.updatedAt,
  };
}

app.use(cors({
  credentials: true,
  origin: env.FRONTEND_ORIGIN,
}));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tuneboss-marketplace-api" });
});

app.post("/api/auth/register", register);
app.post("/api/auth/login", login);
app.get("/api/auth/me", me);
app.post("/api/auth/logout", logout);

app.get("/api/account", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk melihat profil." });
  return res.json({ user });
});

app.patch("/api/account", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk mengubah profil." });

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [updated] = await db
    .update(users)
    .set({ name: parsed.data.name, phone: parsed.data.phone, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning({ email: users.email, id: users.id, name: users.name, phone: users.phone, role: users.role });

  return res.json({ user: updated });
});

app.patch("/api/account/password", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk mengubah kata sandi." });

  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [found] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!found || !verifyPassword(parsed.data.currentPassword, found.passwordHash)) {
    return res.status(400).json({ message: "Kata sandi saat ini salah." });
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(parsed.data.newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return res.json({ ok: true });
});

app.get("/api/admin/orders", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const data = [];
  for (const order of rows) data.push(await orderDetail(order));

  return res.json({ orders: data });
});

app.get("/api/admin/orders/:id", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const [order] = await db.select().from(orders).where(eq(orders.id, id.data)).limit(1);
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  return res.json({ order: await orderDetail(order) });
});

app.patch("/api/admin/orders/:id/status", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const parsed = adminOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [updated] = await db
    .update(orders)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(orders.id, id.data))
    .returning();
  if (!updated) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  return res.json({ order: await orderDetail(updated) });
});

app.get("/api/products", async (_req, res) => {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.createdAt));

  res.json({ products: rows.map(productDto) });
});

app.get("/api/products/:slug", async (req, res) => {
  const rows = await db.select().from(products).where(eq(products.isActive, true));
  const product = rows.find((row) => row.id === req.params.slug || slugify(row.name) === req.params.slug);
  if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });
  return res.json({ product: productDto(product) });
});

app.get("/api/tracking/:orderId", async (req, res) => {
  const [order] = await db.select().from(orders).where(eq(orders.id, req.params.orderId)).limit(1);
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  const items = await db
    .select({ name: products.name, quantity: orderItems.quantity })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.id));

  return res.json({
    order: {
      createdAt: order.createdAt,
      id: order.id,
      items,
      status: order.status,
      total: Number(order.total),
      updatedAt: order.updatedAt,
    },
  });
});

app.get("/api/orders", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk melihat riwayat pesanan." });

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, user.id))
    .orderBy(desc(orders.createdAt));

  const data = [];
  for (const order of rows) {
    const items = await db
      .select({
        id: products.id,
        name: products.name,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, order.id));

    data.push({
      addressId: order.addressId,
      createdAt: order.createdAt,
      id: order.id,
      items: items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
      status: order.status,
      total: Number(order.total),
      updatedAt: order.updatedAt,
    });
  }

  return res.json({ orders: data });
});

app.get("/api/addresses", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk melihat alamat." });

  const rows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.customerId, user.id))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));

  return res.json({ addresses: rows });
});

app.post("/api/addresses", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk menyimpan alamat." });

  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const id = randomUUID();
  await db.transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.update(addresses).set({ isDefault: false, updatedAt: new Date() }).where(eq(addresses.customerId, user.id));
    }
    await tx.insert(addresses).values({ ...parsed.data, customerId: user.id, id });
  });

  const [address] = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
  return res.status(201).json({ address });
});

app.patch("/api/addresses/:id", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk mengubah alamat." });

  const parsed = addressPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [address] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, req.params.id), eq(addresses.customerId, user.id)))
    .limit(1);
  if (!address) return res.status(404).json({ message: "Alamat tidak ditemukan." });

  await db.transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.update(addresses).set({ isDefault: false, updatedAt: new Date() }).where(eq(addresses.customerId, user.id));
    }
    await tx
      .update(addresses)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(addresses.id, address.id), eq(addresses.customerId, user.id)));
  });

  const [updated] = await db.select().from(addresses).where(eq(addresses.id, address.id)).limit(1);
  return res.json({ address: updated });
});

app.delete("/api/addresses/:id", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk menghapus alamat." });

  const [address] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, req.params.id), eq(addresses.customerId, user.id)))
    .limit(1);
  if (!address) return res.status(404).json({ message: "Alamat tidak ditemukan." });

  await db.delete(addresses).where(and(eq(addresses.id, address.id), eq(addresses.customerId, user.id)));
  return res.status(204).send();
});

app.post("/api/orders", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk checkout." });

  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [address] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, parsed.data.addressId), eq(addresses.customerId, user.id)))
    .limit(1);
  if (!address) return res.status(400).json({ message: "Pilih alamat pengiriman yang valid." });

  const requested = new Map<string, number>();
  for (const item of parsed.data.items) {
    requested.set(item.id, (requested.get(item.id) ?? 0) + item.quantity);
  }

  const rows = [] as (typeof products.$inferSelect)[];
  for (const id of requested.keys()) {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (product) rows.push(product);
  }

  if (rows.length !== requested.size) return res.status(400).json({ message: "Sebagian produk tidak ditemukan." });
  const inactive = rows.find((product) => !product.isActive);
  if (inactive) return res.status(400).json({ message: `${inactive.name} tidak tersedia.` });

  const insufficient = rows.find((product) => (requested.get(product.id) ?? 0) > product.stock);
  if (insufficient) return res.status(400).json({ message: `Stok ${insufficient.name} tidak cukup.` });

  const items = rows.map((product) => {
    const quantity = requested.get(product.id) ?? 0;
    const unitPrice = Number(product.price);
    return { product, quantity, total: unitPrice * quantity, unitPrice };
  });
  const total = items.reduce((sum, item) => sum + item.total, 0).toFixed(2);

  const orderId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(orders).values({ addressId: address.id, customerId: user.id, id: orderId, status: "pending", total });
    await tx.insert(orderItems).values(items.map((item) => ({
      orderId,
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
    })));
  });

  return res.status(201).json({
    order: {
      addressId: address.id,
      id: orderId,
      status: "pending",
      total: Number(total),
      items: items.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.unitPrice,
        quantity: item.quantity,
      })),
    },
  });
});

app.post("/api/payments/xendit/invoice", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk membayar." });

  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const apiKey = env.XENDIT_SECRET_KEY;
  if (!apiKey || apiKey === "YOUR_XENDIT_SECRET_KEY_HERE") {
    return res.status(500).json({ message: "XENDIT_SECRET_KEY belum dikonfigurasi." });
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, parsed.data.orderId), eq(orders.customerId, user.id)))
    .limit(1);

  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  if (order.status !== "pending") return res.status(400).json({ message: "Pesanan tidak dapat dibayar." });

  const rows = await db
    .select({
      name: products.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.id));

  const redirectUrl = `${env.FRONTEND_ORIGIN}/checkout/${order.id}`;
  const payload = {
    amount: Number(order.total),
    currency: "IDR",
    customer: { given_names: user.name },
    description: `Pembayaran Pesanan TuneBoss - ${order.id}`,
    external_id: order.id,
    failure_redirect_url: `${redirectUrl}?status=failed`,
    invoice_duration: 86400,
    items: rows.map((item) => ({ name: item.name, price: Number(item.unitPrice), quantity: item.quantity })),
    payer_email: user.email,
    success_redirect_url: `${redirectUrl}?status=success`,
  };

  const xenditRes = await fetch("https://api.xendit.co/v2/invoices", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await xenditRes.text();
  const data = text ? JSON.parse(text) : {};
  if (!xenditRes.ok) return res.status(xenditRes.status).json({ message: data.message || data.error_code || "Gagal membuat tagihan Xendit." });

  return res.json({ id: data.id, invoice_url: data.invoice_url });
});

app.post("/api/webhooks/xendit", async (req, res) => {
  const expectedToken = env.XENDIT_WEBHOOK_TOKEN;
  if (expectedToken && !safeEqual(req.header("x-callback-token") ?? "", expectedToken)) {
    return res.status(401).json({ message: "Invalid webhook token." });
  }

  const parsed = xenditWebhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.external_id)).limit(1);
  if (!order) return res.json({ ok: true });

  const status = parsed.data.status.toUpperCase();
  if (["PAID", "SETTLED"].includes(status)) {
    if (order.status !== "pending") return res.json({ ok: true });

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ status: "paid", updatedAt: new Date() }).where(eq(orders.id, order.id));
      for (const item of items) {
        await tx.update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
          .where(eq(products.id, item.productId));
        await tx.insert(stockMovements).values({
          note: `Order ${order.id}`,
          productId: item.productId,
          quantity: item.quantity,
          type: "sale",
        });
      }
    });
  }

  if (["EXPIRED", "FAILED", "VOIDED"].includes(status) && order.status === "pending") {
    await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, order.id));
  }

  return res.json({ ok: true });
});
