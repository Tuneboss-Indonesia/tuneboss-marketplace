import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { currentUser, hashPassword, login, logout, me, register, verifyPassword } from "./auth.js";
import { db } from "./db/client.js";
import { addresses, orderItems, orders, paymentEvents, products, stockMovements, user as users } from "./db/schema.js";
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

const adminFulfillmentSchema = z.object({
  courier: z.string().trim().max(80).optional(),
  deliveredAt: z.coerce.date().nullable().optional(),
  shippedAt: z.coerce.date().nullable().optional(),
  trackingNumber: z.string().trim().max(120).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "Minimal satu field harus diisi." });

const adminProductSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().optional().default(""),
  imageUrl: z.string().trim().url().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  name: z.string().trim().min(2),
  price: z.coerce.number().positive(),
  sku: z.string().trim().min(2),
  stock: z.coerce.number().int().min(0).optional().default(0),
});

const adminProductPatchSchema = adminProductSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Minimal satu field harus diisi.",
});

const adminStockSchema = z.object({
  note: z.string().trim().optional().default("Admin stock update"),
  stock: z.coerce.number().int().min(0),
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

async function recordPaymentEvent(input: {
  eventType: string;
  externalId?: string;
  orderId?: string | null;
  payload: unknown;
  providerReference?: string;
  status?: string;
}) {
  await db.insert(paymentEvents).values({
    eventType: input.eventType,
    externalId: input.externalId ?? "",
    orderId: input.orderId ?? null,
    payload: input.payload,
    providerReference: input.providerReference ?? "",
    status: input.status ?? "",
  });
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

function paginationFrom(req: Request) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
}

const pageMeta = (total: number, limit: number, offset: number) => ({ limit, offset, total });

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
    courier: order.courier,
    createdAt: order.createdAt,
    customer: customer ?? null,
    customerId: order.customerId,
    deliveredAt: order.deliveredAt,
    id: order.id,
    items: items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
    paymentExpiresAt: order.paymentExpiresAt,
    paymentInvoiceId: order.paymentInvoiceId,
    paymentInvoiceStatus: order.paymentInvoiceStatus,
    paymentInvoiceUrl: order.paymentInvoiceUrl,
    shippedAt: order.shippedAt,
    status: order.status,
    stockReserved: order.stockReserved,
    total: Number(order.total),
    trackingNumber: order.trackingNumber,
    updatedAt: order.updatedAt,
  };
}

async function cancelPendingOrder(order: typeof orders.$inferSelect, note: string) {
  const items = order.stockReserved ? await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)) : [];
  const [updated] = await db.transaction(async (tx) => {
    const [cancelled] = await tx
      .update(orders)
      .set({ status: "cancelled", stockReserved: false, updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
      .returning();
    if (!cancelled) return [];

    for (const item of items) {
      await tx.update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: new Date() })
        .where(eq(products.id, item.productId));
      await tx.insert(stockMovements).values({ note, productId: item.productId, quantity: item.quantity, type: "in" });
    }

    return [cancelled];
  });
  return updated;
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

  const { limit, offset } = paginationFrom(req);
  const filters: SQL[] = [];
  const status = adminOrderStatusSchema.shape.status.safeParse(req.query.status);
  const q = String(req.query.q ?? "").trim();

  if (status.success) filters.push(eq(orders.status, status.data));
  if (q) {
    const like = `%${q}%`;
    filters.push(sql`(${orders.id}::text ilike ${like} or exists (
      select 1 from "user" customer
      where customer.id = ${orders.customerId}
      and (customer.email ilike ${like} or customer.name ilike ${like})
    ))`);
  }

  const where = filters.length ? and(...filters) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(orders).where(where);
  const rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
  const data = [];
  for (const order of rows) data.push(await orderDetail(order));

  return res.json({ orders: data, pagination: pageMeta(Number(total), limit, offset) });
});

app.get("/api/admin/customers", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const { limit, offset } = paginationFrom(req);
  const q = String(req.query.q ?? "").trim();
  const filters: SQL[] = [eq(users.role, "customer")];
  if (q) {
    const like = `%${q}%`;
    filters.push(sql`(${users.email} ilike ${like} or ${users.name} ilike ${like} or ${users.phone} ilike ${like})`);
  }

  const where = and(...filters);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(users).where(where);
  const customers = await db
    .select({ createdAt: users.createdAt, email: users.email, id: users.id, name: users.name, phone: users.phone, updatedAt: users.updatedAt })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return res.json({ customers, pagination: pageMeta(Number(total), limit, offset) });
});

app.get("/api/admin/summary", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const [orderTotals] = await db.select({
    cancelledOrders: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`,
    fulfilledOrders: sql<number>`count(*) filter (where ${orders.status} = 'fulfilled')`,
    paidOrders: sql<number>`count(*) filter (where ${orders.status} = 'paid')`,
    pendingOrders: sql<number>`count(*) filter (where ${orders.status} = 'pending')`,
    revenue: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ('paid', 'fulfilled')), 0)`,
    totalOrders: sql<number>`count(*)`,
  }).from(orders);
  const [customerTotals] = await db.select({ totalCustomers: sql<number>`count(*)` }).from(users).where(eq(users.role, "customer"));
  const [productTotals] = await db.select({
    activeProducts: sql<number>`count(*) filter (where ${products.isActive} = true)`,
    lowStockProducts: sql<number>`count(*) filter (where ${products.isActive} = true and ${products.stock} <= 5)`,
    totalProducts: sql<number>`count(*)`,
  }).from(products);

  return res.json({
    summary: {
      ...orderTotals,
      ...customerTotals,
      ...productTotals,
      revenue: Number(orderTotals.revenue),
    },
  });
});

app.post("/api/admin/orders/expire-pending", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const rows = await db.select().from(orders).where(and(
    eq(orders.status, "pending"),
    sql`${orders.paymentExpiresAt} is not null`,
    sql`${orders.paymentExpiresAt} <= now()`,
  ));
  const expired = [];
  for (const order of rows) {
    const cancelled = await cancelPendingOrder(order, `Expired order ${order.id}`);
    if (cancelled) expired.push({ id: cancelled.id, paymentExpiresAt: cancelled.paymentExpiresAt });
  }

  return res.json({ expired });
});

app.get("/api/admin/orders/:id", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const [order] = await db.select().from(orders).where(eq(orders.id, id.data)).limit(1);
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  return res.json({ order: await orderDetail(order) });
});

app.get("/api/admin/orders/:id/payment-events", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, id.data)).limit(1);
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  const events = await db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.orderId, order.id))
    .orderBy(desc(paymentEvents.createdAt));

  return res.json({ events });
});

app.patch("/api/admin/orders/:id/status", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const parsed = adminOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [order] = await db.select().from(orders).where(eq(orders.id, id.data)).limit(1);
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  if (parsed.data.status === "cancelled" && order.status === "pending") {
    const cancelled = await cancelPendingOrder(order, `Admin cancelled order ${order.id}`);
    return res.json({ order: await orderDetail(cancelled ?? order) });
  }

  const [updated] = await db
    .update(orders)
    .set({
      status: parsed.data.status,
      stockReserved: ["paid", "fulfilled"].includes(parsed.data.status) ? false : undefined,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id.data))
    .returning();

  return res.json({ order: await orderDetail(updated) });
});

app.patch("/api/admin/orders/:id/fulfillment", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const parsed = adminFulfillmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [order] = await db.select().from(orders).where(eq(orders.id, id.data)).limit(1);
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  if (order.status === "cancelled") return res.status(400).json({ message: "Pesanan dibatalkan tidak dapat dikirim." });

  const deliveredAt = parsed.data.deliveredAt;
  const shippedAt = deliveredAt instanceof Date && parsed.data.shippedAt === undefined && !order.shippedAt
    ? deliveredAt
    : parsed.data.shippedAt;

  const [updated] = await db
    .update(orders)
    .set({
      courier: parsed.data.courier,
      deliveredAt,
      shippedAt,
      status: deliveredAt instanceof Date ? "fulfilled" : undefined,
      trackingNumber: parsed.data.trackingNumber,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id))
    .returning();

  return res.json({ order: await orderDetail(updated) });
});

app.get("/api/admin/products", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const { limit, offset } = paginationFrom(req);
  const q = String(req.query.q ?? "").trim();
  const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
  const filters: SQL[] = [];

  if (active !== undefined) filters.push(eq(products.isActive, active));
  if (q) {
    const like = `%${q}%`;
    filters.push(sql`(${products.name} ilike ${like} or ${products.sku} ilike ${like})`);
  }

  const where = filters.length ? and(...filters) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(products).where(where);
  const rows = await db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(limit).offset(offset);
  return res.json({ products: rows.map(productDto), pagination: pageMeta(Number(total), limit, offset) });
});

app.get("/api/admin/products/low-stock", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const { limit, offset } = paginationFrom(req);
  const threshold = Math.max(Number(req.query.threshold) || 5, 0);
  const where = and(eq(products.isActive, true), sql`${products.stock} <= ${threshold}`);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(products).where(where);
  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(sql`${products.stock} asc`, desc(products.createdAt))
    .limit(limit)
    .offset(offset);

  return res.json({ products: rows.map(productDto), threshold, pagination: pageMeta(Number(total), limit, offset) });
});

app.get("/api/admin/products/:id", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID produk tidak valid." });

  const [product] = await db.select().from(products).where(eq(products.id, id.data)).limit(1);
  if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });

  return res.json({ product: productDto(product) });
});

app.post("/api/admin/products", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const parsed = adminProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const id = randomUUID();
  try {
    const [product] = await db.insert(products).values({
      ...parsed.data,
      id,
      imageUrl: parsed.data.imageUrl ?? null,
      price: parsed.data.price.toFixed(2),
    }).returning();

    if (parsed.data.stock > 0) {
      await db.insert(stockMovements).values({ note: "Initial stock", productId: id, quantity: parsed.data.stock, type: "in" });
    }

    return res.status(201).json({ product: productDto(product) });
  } catch {
    return res.status(409).json({ message: "SKU sudah digunakan." });
  }
});

app.patch("/api/admin/products/:id", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID produk tidak valid." });

  const parsed = adminProductPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const values = {
    ...parsed.data,
    imageUrl: parsed.data.imageUrl === undefined ? undefined : parsed.data.imageUrl,
    price: parsed.data.price === undefined ? undefined : parsed.data.price.toFixed(2),
    updatedAt: new Date(),
  };

  try {
    const [product] = await db.update(products).set(values).where(eq(products.id, id.data)).returning();
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });
    return res.json({ product: productDto(product) });
  } catch {
    return res.status(409).json({ message: "SKU sudah digunakan." });
  }
});

app.patch("/api/admin/products/:id/stock", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID produk tidak valid." });

  const parsed = adminStockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [current] = await db.select().from(products).where(eq(products.id, id.data)).limit(1);
  if (!current) return res.status(404).json({ message: "Produk tidak ditemukan." });

  const delta = parsed.data.stock - current.stock;
  const [product] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(products)
      .set({ stock: parsed.data.stock, updatedAt: new Date() })
      .where(eq(products.id, id.data))
      .returning();
    if (delta !== 0) {
      await tx.insert(stockMovements).values({
        note: parsed.data.note,
        productId: id.data,
        quantity: Math.abs(delta),
        type: delta > 0 ? "in" : "out",
      });
    }
    return [updated];
  });

  return res.json({ product: productDto(product) });
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
      courier: order.courier,
      deliveredAt: order.deliveredAt,
      id: order.id,
      items,
      paymentExpiresAt: order.paymentExpiresAt,
      paymentInvoiceId: order.paymentInvoiceId,
      paymentInvoiceStatus: order.paymentInvoiceStatus,
      paymentInvoiceUrl: order.paymentInvoiceUrl,
      shippedAt: order.shippedAt,
      status: order.status,
      stockReserved: order.stockReserved,
      total: Number(order.total),
      trackingNumber: order.trackingNumber,
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
      courier: order.courier,
      deliveredAt: order.deliveredAt,
      id: order.id,
      items: items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
      paymentExpiresAt: order.paymentExpiresAt,
      paymentInvoiceId: order.paymentInvoiceId,
      paymentInvoiceStatus: order.paymentInvoiceStatus,
      paymentInvoiceUrl: order.paymentInvoiceUrl,
      shippedAt: order.shippedAt,
      status: order.status,
      stockReserved: order.stockReserved,
      total: Number(order.total),
      trackingNumber: order.trackingNumber,
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
  try {
    await db.transaction(async (tx) => {
      await tx.insert(orders).values({ addressId: address.id, customerId: user.id, id: orderId, status: "pending", stockReserved: true, total });
      await tx.insert(orderItems).values(items.map((item) => ({
        orderId,
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
      })));

      for (const item of items) {
        const [reserved] = await tx.update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
          .where(and(eq(products.id, item.product.id), sql`${products.stock} >= ${item.quantity}`))
          .returning({ id: products.id });
        if (!reserved) throw new Error("INSUFFICIENT_STOCK");
        await tx.insert(stockMovements).values({ note: `Reserved for order ${orderId}`, productId: item.product.id, quantity: item.quantity, type: "out" });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return res.status(409).json({ message: "Stok berubah. Silakan cek keranjang dan coba lagi." });
    }
    throw error;
  }

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

app.post("/api/orders/:id/cancel", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk membatalkan pesanan." });

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id.data), eq(orders.customerId, user.id)))
    .limit(1);

  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  if (order.status !== "pending") return res.status(400).json({ message: "Hanya pesanan pending yang dapat dibatalkan." });

  const updated = await cancelPendingOrder(order, `Customer cancelled order ${order.id}`);

  return res.json({ order: await orderDetail(updated ?? order) });
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
  if (order.paymentInvoiceUrl && order.paymentExpiresAt && order.paymentExpiresAt > new Date()) {
    return res.json({
      id: order.paymentInvoiceId,
      invoice_url: order.paymentInvoiceUrl,
      paymentExpiresAt: order.paymentExpiresAt,
      reused: true,
      status: order.paymentInvoiceStatus,
    });
  }

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
  const paymentExpiresAt = new Date(Date.now() + payload.invoice_duration * 1000);

  await recordPaymentEvent({
    eventType: xenditRes.ok ? "invoice.created" : "invoice.failed",
    externalId: order.id,
    orderId: order.id,
    payload: data,
    providerReference: typeof data.id === "string" ? data.id : "",
    status: typeof data.status === "string" ? data.status : String(xenditRes.status),
  });

  if (!xenditRes.ok) return res.status(xenditRes.status).json({ message: data.message || data.error_code || "Gagal membuat tagihan Xendit." });

  const invoiceId = typeof data.id === "string" ? data.id : "";
  const invoiceUrl = typeof data.invoice_url === "string" ? data.invoice_url : "";
  const invoiceStatus = typeof data.status === "string" ? data.status : "";

  await db.update(orders).set({
    paymentExpiresAt,
    paymentInvoiceId: invoiceId,
    paymentInvoiceStatus: invoiceStatus,
    paymentInvoiceUrl: invoiceUrl,
    updatedAt: new Date(),
  }).where(eq(orders.id, order.id));

  return res.json({ id: invoiceId, invoice_url: invoiceUrl, paymentExpiresAt, status: invoiceStatus });
});

app.post("/api/webhooks/xendit", async (req, res) => {
  const expectedToken = env.XENDIT_WEBHOOK_TOKEN;
  if (expectedToken && !safeEqual(req.header("x-callback-token") ?? "", expectedToken)) {
    return res.status(401).json({ message: "Invalid webhook token." });
  }

  const parsed = xenditWebhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.external_id)).limit(1);
  await recordPaymentEvent({
    eventType: "webhook.received",
    externalId: parsed.data.external_id,
    orderId: order?.id ?? null,
    payload: req.body,
    providerReference: typeof req.body.id === "string" ? req.body.id : "",
    status: parsed.data.status,
  });
  if (!order) return res.json({ ok: true });

  const status = parsed.data.status.toUpperCase();
  if (["PAID", "SETTLED"].includes(status)) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    await db.transaction(async (tx) => {
      const [paid] = await tx
        .update(orders)
        .set({ paymentInvoiceStatus: parsed.data.status, status: "paid", stockReserved: false, updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
        .returning({ id: orders.id });
      if (!paid) return;

      for (const item of items) {
        if (!order.stockReserved) {
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
      }
    });
  }

  if (["EXPIRED", "FAILED", "VOIDED"].includes(status) && order.status === "pending") {
    await db.update(orders).set({ paymentInvoiceStatus: parsed.data.status, updatedAt: new Date() }).where(eq(orders.id, order.id));
    await cancelPendingOrder(order, `Payment ${status.toLowerCase()} for order ${order.id}`);
  }

  return res.json({ ok: true });
});
