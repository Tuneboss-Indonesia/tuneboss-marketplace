import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { currentUser, hashPassword, login, logout, me, register, verifyPassword } from "./auth.js";
import { db } from "./db/client.js";
import { addresses, adminAuditLogs, categories, emailVerificationTokens, orderItems, orders, passwordResetTokens, paymentEvents, productImages, productReviews, products, stockMovements, user as users } from "./db/schema.js";
import { sendEmail } from "./email.js";
import { getOrderDeliveredEmail, getOrderShippedEmail, getOtpResetPasswordEmail, getOtpVerificationEmail, getPaymentCancelEmail, getPaymentExpiredEmail, getPaymentSuccessEmail } from "./emails/index.js";
import { env } from "./env.js";

export const app = express();

const allowedOrigins = [env.FRONTEND_ORIGIN, env.ADMIN_ORIGIN].filter(Boolean);
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(name: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: () => void) => {
    const key = `${name}:${req.ip ?? "unknown"}`;
    const now = Date.now();
    const current = rateLimits.get(key);
    if (!current || current.resetAt <= now) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (current.count >= max) return res.status(429).json({ message: "Terlalu banyak percobaan. Coba lagi sebentar." });
    current.count += 1;
    return next();
  };
}

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/&/g, "and")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const formatRupiah = (value: string) => `Rp. ${new Intl.NumberFormat("id-ID").format(Number(value))}`;
const shippingOptions = {
  REGULAR: { freeThreshold: 2_000_000, label: "Regular", price: 25_000 },
};

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

function productMatchesSlug(product: typeof products.$inferSelect, slug: string) {
  const brand = brandFrom(product.name, product.sku);
  return product.id === slug || slugify(product.name) === slug || slugify(`${brand} ${product.name}`) === slug;
}

function shippingQuote(subtotal: number, method: keyof typeof shippingOptions = "REGULAR") {
  const option = shippingOptions[method];
  return { cost: subtotal >= option.freeThreshold ? 0 : option.price, label: option.label, method };
}

function analyticsRange(timeframe: "thisMonth" | "thisYear" | "lastYear") {
  const now = new Date();
  if (timeframe === "thisYear") return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
  if (timeframe === "lastYear") return { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear(), 0, 1) };
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

const orderSchema = z.object({
  addressId: z.string().uuid(),
  items: z.array(z.object({
    id: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
  })).min(1),
  shippingMethod: z.enum(["REGULAR"]).optional().default("REGULAR"),
});

const shippingQuoteSchema = orderSchema.pick({ addressId: true, items: true, shippingMethod: true });

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

const forgotPasswordSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
});

const resetOtpSchema = forgotPasswordSchema.extend({
  otp: z.string().regex(/^\d{6}$/),
});

const resetPasswordSchema = resetOtpSchema.extend({
  password: z.string().min(8),
});

const verifyEmailSchema = resetOtpSchema;

const passwordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const adminOrderStatusSchema = z.object({
  status: z.enum(["draft", "pending", "paid", "cancelled", "fulfilled"]),
});

const adminAnalyticsSchema = z.object({
  timeframe: z.enum(["thisMonth", "thisYear", "lastYear"]).optional().default("thisMonth"),
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
  images: z.array(z.string().trim().url()).max(8).optional(),
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

const productReviewSchema = z.object({
  quote: z.string().trim().min(10).max(500),
  rating: z.coerce.number().int().min(1).max(5),
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
  }).onConflictDoNothing();
}

async function sendOrderEmail(order: typeof orders.$inferSelect, subject: string, render: (name: string) => string) {
  if (!order.customerId) return;
  const [customer] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, order.customerId)).limit(1);
  if (!customer?.email) return;

  try {
    await sendEmail({ html: render(customer.name), subject, to: customer.email });
  } catch (error) {
    console.error(error);
  }
}

async function findValidResetToken(email: string, otp: string) {
  const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!found) return null;

  const tokens = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, found.id), sql`${passwordResetTokens.expiresAt} > now()`, sql`${passwordResetTokens.usedAt} is null`))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(5);

  const token = tokens.find((row) => verifyPassword(otp, row.tokenHash));
  return token ? { token, user: found } : null;
}

async function findValidEmailVerificationToken(email: string, otp: string) {
  const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!found) return null;

  const tokens = await db
    .select()
    .from(emailVerificationTokens)
    .where(and(eq(emailVerificationTokens.userId, found.id), sql`${emailVerificationTokens.expiresAt} > now()`, sql`${emailVerificationTokens.usedAt} is null`))
    .orderBy(desc(emailVerificationTokens.createdAt))
    .limit(5);

  const token = tokens.find((row) => verifyPassword(otp, row.tokenHash));
  return token ? { token, user: found } : null;
}

async function sendEmailVerificationOtp(email: string) {
  const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!found || found.emailVerified) return;
  const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(emailVerificationTokens).values({ expiresAt: new Date(Date.now() + 15 * 60_000), tokenHash: hashPassword(otp), userId: found.id });
  await sendEmail({ html: getOtpVerificationEmail(found.name, otp), subject: "Verifikasi Email TuneBoss", to: found.email });
}

function paymentDetails(order: typeof orders.$inferSelect) {
  return {
    date: new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(order.updatedAt),
    method: "Xendit",
    orderId: order.id,
    total: formatRupiah(order.total),
  };
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

type StaffUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

async function auditAdmin(actor: StaffUser, action: string, targetType: string, targetId: string, payload: unknown = {}) {
  await db.insert(adminAuditLogs).values({ action, actorId: actor.id, payload, targetId, targetType });
}

function paginationFrom(req: Request) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
}

const pageMeta = (total: number, limit: number, offset: number) => ({ limit, offset, total });

type OrderStatus = typeof orders.$inferSelect.status;

function canMoveOrderStatus(from: OrderStatus, to: OrderStatus) {
  if (from === to) return true;
  if (from === "draft") return to === "pending" || to === "cancelled";
  if (from === "pending") return to === "paid" || to === "cancelled";
  if (from === "paid") return to === "fulfilled";
  return false;
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
    shippingCost: Number(order.shippingCost),
    shippingMethod: order.shippingMethod,
    status: order.status,
    stockReserved: order.stockReserved,
    total: Number(order.total),
    trackingNumber: order.trackingNumber,
    updatedAt: order.updatedAt,
  };
}

async function productDetailDto(product: typeof products.$inferSelect) {
  const images = await db
    .select({ imageUrl: productImages.imageUrl })
    .from(productImages)
    .where(eq(productImages.productId, product.id))
    .orderBy(productImages.sortOrder, productImages.createdAt);
  const fallback = product.imageUrl ?? "/images/tuneboss-motorcycle-ecu.png";
  return { ...productDto(product), images: images.length ? images.map((image) => image.imageUrl) : [fallback] };
}

async function replaceProductImages(productId: string, images: string[] | undefined) {
  if (!images) return;
  await db.transaction(async (tx) => {
    await tx.delete(productImages).where(eq(productImages.productId, productId));
    if (images.length) {
      await tx.insert(productImages).values(images.map((imageUrl, sortOrder) => ({ imageUrl, productId, sortOrder })));
    }
  });
}

async function pricedCart(items: Array<{ id: string; quantity: number }>) {
  const requested = new Map<string, number>();
  for (const item of items) requested.set(item.id, (requested.get(item.id) ?? 0) + item.quantity);

  const rows = [] as (typeof products.$inferSelect)[];
  for (const id of requested.keys()) {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (product) rows.push(product);
  }

  if (rows.length !== requested.size) return { error: "Sebagian produk tidak ditemukan." } as const;
  const inactive = rows.find((product) => !product.isActive);
  if (inactive) return { error: `${inactive.name} tidak tersedia.` } as const;
  const insufficient = rows.find((product) => (requested.get(product.id) ?? 0) > product.stock);
  if (insufficient) return { error: `Stok ${insufficient.name} tidak cukup.` } as const;

  const pricedItems = rows.map((product) => {
    const quantity = requested.get(product.id) ?? 0;
    const unitPrice = Number(product.price);
    return { product, quantity, total: unitPrice * quantity, unitPrice };
  });
  return { items: pricedItems, subtotal: pricedItems.reduce((sum, item) => sum + item.total, 0) } as const;
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

async function expirePendingOrders() {
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
  return expired;
}

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
}));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tuneboss-marketplace-api" });
});

app.get("/api/ready", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    return res.json({ database: "ok", ok: true, service: "tuneboss-marketplace-api" });
  } catch {
    return res.status(503).json({ database: "error", ok: false, service: "tuneboss-marketplace-api" });
  }
});

app.post("/api/auth/register", rateLimit("auth.register", 10, 15 * 60_000), register);
app.post("/api/auth/login", rateLimit("auth.login", 20, 15 * 60_000), login);
app.get("/api/auth/me", me);
app.post("/api/auth/logout", logout);

app.post("/api/auth/forgot-password", rateLimit("auth.forgot", 5, 15 * 60_000), async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [found] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (found) {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.insert(passwordResetTokens).values({ expiresAt: new Date(Date.now() + 15 * 60_000), tokenHash: hashPassword(otp), userId: found.id });
    await sendEmail({ html: getOtpResetPasswordEmail(found.name, otp), subject: "Reset Password TuneBoss", to: found.email });
  }

  return res.json({ ok: true });
});

app.post("/api/auth/forgot-password/verify", rateLimit("auth.forgot.verify", 20, 15 * 60_000), async (req, res) => {
  const parsed = resetOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  if (!await findValidResetToken(parsed.data.email, parsed.data.otp)) return res.status(400).json({ message: "OTP tidak valid atau sudah kedaluwarsa." });
  return res.json({ ok: true });
});

app.post("/api/auth/reset-password", rateLimit("auth.reset", 10, 15 * 60_000), async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const found = await findValidResetToken(parsed.data.email, parsed.data.otp);
  if (!found) return res.status(400).json({ message: "OTP tidak valid atau sudah kedaluwarsa." });

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashPassword(parsed.data.password), updatedAt: new Date() }).where(eq(users.id, found.user.id));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, found.token.id));
  });

  return res.json({ ok: true });
});

app.post("/api/auth/email-verification/request", rateLimit("auth.email.verify.request", 5, 15 * 60_000), async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  await sendEmailVerificationOtp(parsed.data.email);
  return res.json({ ok: true });
});

app.post("/api/auth/email-verification/verify", rateLimit("auth.email.verify", 20, 15 * 60_000), async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const found = await findValidEmailVerificationToken(parsed.data.email, parsed.data.otp);
  if (!found) return res.status(400).json({ message: "OTP tidak valid atau sudah kedaluwarsa." });

  await db.transaction(async (tx) => {
    await tx.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, found.user.id));
    await tx.update(emailVerificationTokens).set({ usedAt: new Date() }).where(eq(emailVerificationTokens.id, found.token.id));
  });

  return res.json({ ok: true });
});

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
  const rows = await db
    .select({
      createdAt: users.createdAt,
      email: users.email,
      emailVerified: users.emailVerified,
      id: users.id,
      name: users.name,
      phone: users.phone,
      totalOrders: sql<number>`count(${orders.id})`,
      totalSpent: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ('paid', 'fulfilled')), 0)`,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .leftJoin(orders, eq(orders.customerId, users.id))
    .where(where)
    .groupBy(users.id, users.name, users.email, users.emailVerified, users.phone, users.createdAt, users.updatedAt)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
  const customers = rows.map((customer) => ({
    ...customer,
    totalOrders: Number(customer.totalOrders),
    totalSpent: Number(customer.totalSpent),
  }));

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

app.get("/api/admin/analytics", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const parsed = adminAnalyticsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const { from, to } = analyticsRange(parsed.data.timeframe);
  const completed = sql`${orders.status} in ('paid', 'fulfilled')`;
  const inRange = sql`${orders.createdAt} >= ${from} and ${orders.createdAt} < ${to}`;
  const where = sql`${completed} and ${inRange}`;

  const [summary] = await db.select({
    customers: sql<number>`count(distinct ${orders.customerId})`,
    orders: sql<number>`count(*)`,
    revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
  }).from(orders).where(where);
  const [orderTotals] = await db.select({ orders: sql<number>`count(*)` }).from(orders).where(inRange);

  const revenue = await db
    .select({
      name: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'DD Mon')`,
      total: sql<string>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .where(where)
    .groupBy(sql`date_trunc('day', ${orders.createdAt})`)
    .orderBy(sql`date_trunc('day', ${orders.createdAt})`);

  const topProducts = await db
    .select({ name: products.name, sales: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(where)
    .groupBy(products.id, products.name)
    .orderBy(desc(sql`coalesce(sum(${orderItems.quantity}), 0)`))
    .limit(5);

  const categoryRows = await db
    .select({ name: sql<string>`coalesce(${categories.name}, 'Tanpa Kategori')`, value: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(where)
    .groupBy(sql`coalesce(${categories.name}, 'Tanpa Kategori')`)
    .orderBy(desc(sql`coalesce(sum(${orderItems.quantity}), 0)`))
    .limit(4);

  return res.json({
    analytics: {
      categories: categoryRows.map((row, index) => ({ ...row, color: `var(--chart-${index + 1})`, value: Number(row.value) })),
      conversion: Number(orderTotals.orders) ? (Number(summary.orders) / Number(orderTotals.orders)) * 100 : 0,
      customers: Number(summary.customers),
      orders: Number(orderTotals.orders),
      revenue: revenue.map((row) => ({ name: row.name, total: Number(row.total) })),
      totalRevenue: Number(summary.revenue),
      topProducts: topProducts.map((row) => ({ name: row.name, sales: Number(row.sales) })),
    },
  });
});

app.get("/api/admin/audit-logs", async (req, res) => {
  if (!await requireStaff(req, res)) return;

  const { limit, offset } = paginationFrom(req);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(adminAuditLogs);
  const logs = await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit).offset(offset);
  return res.json({ logs, pagination: pageMeta(Number(total), limit, offset) });
});

app.post("/api/admin/orders/expire-pending", rateLimit("admin.write", 120, 60_000), async (req, res) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;

  const expired = await expirePendingOrders();
  await auditAdmin(staff, "orders.expire_pending", "orders", "pending", { expired });
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

app.patch("/api/admin/orders/:id/status", rateLimit("admin.write", 120, 60_000), async (req, res) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const parsed = adminOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [order] = await db.select().from(orders).where(eq(orders.id, id.data)).limit(1);
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  if (!canMoveOrderStatus(order.status, parsed.data.status)) {
    return res.status(400).json({ message: `Status ${order.status} tidak dapat diubah menjadi ${parsed.data.status}.` });
  }

  if (parsed.data.status === "cancelled" && order.status === "pending") {
    const cancelled = await cancelPendingOrder(order, `Admin cancelled order ${order.id}`);
    if (cancelled) {
      await sendOrderEmail(cancelled, "Pesanan TuneBoss dibatalkan", (name) => getPaymentCancelEmail(name, paymentDetails(cancelled)));
      await auditAdmin(staff, "orders.status_update", "order", order.id, { from: order.status, to: parsed.data.status });
    }
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

  await auditAdmin(staff, "orders.status_update", "order", order.id, { from: order.status, to: parsed.data.status });
  return res.json({ order: await orderDetail(updated) });
});

app.patch("/api/admin/orders/:id/fulfillment", rateLimit("admin.write", 120, 60_000), async (req, res) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const parsed = adminFulfillmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [order] = await db.select().from(orders).where(eq(orders.id, id.data)).limit(1);
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  if (order.status !== "paid" && order.status !== "fulfilled") {
    return res.status(400).json({ message: "Hanya pesanan paid/fulfilled yang dapat dikirim." });
  }

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

  if (updated.shippedAt && !order.shippedAt) {
    await sendOrderEmail(updated, "Pesanan TuneBoss dikirim", (name) => getOrderShippedEmail(name, { ...paymentDetails(updated), courier: updated.courier || "Kurir" }));
  }
  if (updated.deliveredAt && !order.deliveredAt) {
    await sendOrderEmail(updated, "Pesanan TuneBoss diterima", (name) => getOrderDeliveredEmail(name, paymentDetails(updated)));
  }

  await auditAdmin(staff, "orders.fulfillment_update", "order", order.id, parsed.data);
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

  return res.json({ product: await productDetailDto(product) });
});

app.post("/api/admin/products", rateLimit("admin.write", 120, 60_000), async (req, res) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;

  const parsed = adminProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const id = randomUUID();
  try {
    const [product] = await db.insert(products).values({
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      id,
      imageUrl: parsed.data.imageUrl ?? null,
      isActive: parsed.data.isActive,
      name: parsed.data.name,
      price: parsed.data.price.toFixed(2),
      sku: parsed.data.sku,
      stock: parsed.data.stock,
    }).returning();
    await replaceProductImages(product.id, parsed.data.images);

    if (parsed.data.stock > 0) {
      await db.insert(stockMovements).values({ note: "Initial stock", productId: id, quantity: parsed.data.stock, type: "in" });
    }

    await auditAdmin(staff, "products.create", "product", product.id, { sku: product.sku, stock: product.stock });
    return res.status(201).json({ product: await productDetailDto(product) });
  } catch {
    return res.status(409).json({ message: "SKU sudah digunakan." });
  }
});

app.patch("/api/admin/products/:id", rateLimit("admin.write", 120, 60_000), async (req, res) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID produk tidak valid." });

  const parsed = adminProductPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const values = {
    categoryId: parsed.data.categoryId,
    description: parsed.data.description,
    imageUrl: parsed.data.imageUrl === undefined ? undefined : parsed.data.imageUrl,
    isActive: parsed.data.isActive,
    name: parsed.data.name,
    price: parsed.data.price === undefined ? undefined : parsed.data.price.toFixed(2),
    sku: parsed.data.sku,
    stock: parsed.data.stock,
    updatedAt: new Date(),
  };

  try {
    const [product] = await db.update(products).set(values).where(eq(products.id, id.data)).returning();
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });
    await replaceProductImages(product.id, parsed.data.images);
    await auditAdmin(staff, "products.update", "product", product.id, parsed.data);
    return res.json({ product: await productDetailDto(product) });
  } catch {
    return res.status(409).json({ message: "SKU sudah digunakan." });
  }
});

app.patch("/api/admin/products/:id/stock", rateLimit("admin.write", 120, 60_000), async (req, res) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;

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

  await auditAdmin(staff, "products.stock_update", "product", product.id, { from: current.stock, note: parsed.data.note, to: parsed.data.stock });
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

app.get("/api/categories", async (_req, res) => {
  const rows = await db.select().from(categories).orderBy(categories.name);
  res.json({ categories: rows.map((category) => ({
    description: category.description,
    id: category.id,
    name: category.name,
    slug: slugify(category.name),
  })) });
});

app.get("/api/products/:slug", async (req, res) => {
  const rows = await db.select().from(products).where(eq(products.isActive, true));
  const product = rows.find((row) => productMatchesSlug(row, req.params.slug));
  if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });
  return res.json({ product: await productDetailDto(product) });
});

app.get("/api/products/:slug/reviews", async (req, res) => {
  const rows = await db.select().from(products).where(eq(products.isActive, true));
  const product = rows.find((row) => productMatchesSlug(row, req.params.slug));
  if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });

  const reviews = await db
    .select({ authorName: productReviews.authorName, createdAt: productReviews.createdAt, id: productReviews.id, quote: productReviews.quote, rating: productReviews.rating })
    .from(productReviews)
    .where(eq(productReviews.productId, product.id))
    .orderBy(desc(productReviews.createdAt));

  const total = reviews.length;
  const averageRating = total ? reviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;
  return res.json({ averageRating, reviews, total });
});

app.post("/api/products/:slug/reviews", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk memberi review." });

  const parsed = productReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const rows = await db.select().from(products).where(eq(products.isActive, true));
  const product = rows.find((row) => productMatchesSlug(row, req.params.slug));
  if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });

  const [purchase] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.customerId, user.id), eq(orders.status, "fulfilled"), eq(orderItems.productId, product.id)))
    .limit(1);
  if (!purchase) return res.status(403).json({ message: "Review hanya tersedia untuk produk yang sudah selesai dibeli." });

  const [existing] = await db
    .select({ id: productReviews.id })
    .from(productReviews)
    .where(and(eq(productReviews.productId, product.id), eq(productReviews.customerId, user.id)))
    .limit(1);
  if (existing) return res.status(409).json({ message: "Anda sudah memberi review untuk produk ini." });

  const [review] = await db.insert(productReviews).values({
    authorName: user.name,
    customerId: user.id,
    productId: product.id,
    quote: parsed.data.quote,
    rating: parsed.data.rating,
  }).returning({ authorName: productReviews.authorName, createdAt: productReviews.createdAt, id: productReviews.id, quote: productReviews.quote, rating: productReviews.rating });

  return res.status(201).json({ review });
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

app.get("/api/orders/:id", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk melihat pesanan." });

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: "ID pesanan tidak valid." });

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id.data), eq(orders.customerId, user.id)))
    .limit(1);

  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  return res.json({ order: await orderDetail(order) });
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

app.post("/api/shipping/quote", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk menghitung ongkir." });

  const parsed = shippingQuoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [address] = await db.select().from(addresses).where(and(eq(addresses.id, parsed.data.addressId), eq(addresses.customerId, user.id))).limit(1);
  if (!address) return res.status(400).json({ message: "Pilih alamat pengiriman yang valid." });

  const priced = await pricedCart(parsed.data.items);
  if ("error" in priced) return res.status(400).json({ message: priced.error });

  const quote = shippingQuote(priced.subtotal, parsed.data.shippingMethod);
  return res.json({ quote: { ...quote, subtotal: priced.subtotal, total: priced.subtotal + quote.cost } });
});

app.post("/api/orders", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: "Silakan login untuk checkout." });
  if (!user.emailVerified) return res.status(403).json({ message: "Verifikasi email terlebih dahulu sebelum checkout." });

  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [address] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, parsed.data.addressId), eq(addresses.customerId, user.id)))
    .limit(1);
  if (!address) return res.status(400).json({ message: "Pilih alamat pengiriman yang valid." });

  const priced = await pricedCart(parsed.data.items);
  if ("error" in priced) return res.status(400).json({ message: priced.error });
  const { items, subtotal } = priced;
  const quote = shippingQuote(subtotal, parsed.data.shippingMethod);
  const total = (subtotal + quote.cost).toFixed(2);

  const orderId = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(orders).values({ addressId: address.id, customerId: user.id, id: orderId, shippingCost: quote.cost.toFixed(2), shippingMethod: quote.method, status: "pending", stockReserved: true, total });
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
      shippingCost: quote.cost,
      shippingMethod: quote.method,
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
  if (updated) await sendOrderEmail(updated, "Pesanan TuneBoss dibatalkan", (name) => getPaymentCancelEmail(name, paymentDetails(updated)));

  return res.json({ order: await orderDetail(updated ?? order) });
});

app.post("/api/payments/xendit/invoice", rateLimit("payment.invoice", 30, 15 * 60_000), async (req, res) => {
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

  const [claimed] = await db
    .update(orders)
    .set({ paymentInvoiceStatus: "CREATING", updatedAt: new Date() })
    .where(and(
      eq(orders.id, order.id),
      eq(orders.status, "pending"),
      sql`(${orders.paymentInvoiceUrl} = '' or ${orders.paymentExpiresAt} <= now() or ${orders.paymentExpiresAt} is null)`,
      sql`(${orders.paymentInvoiceStatus} != 'CREATING' or ${orders.updatedAt} <= now() - interval '2 minutes')`,
    ))
    .returning({ id: orders.id });
  if (!claimed) return res.status(409).json({ message: "Invoice sedang dibuat. Coba lagi sebentar." });

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

  if (!xenditRes.ok) {
    await db.update(orders).set({ paymentInvoiceStatus: "FAILED", updatedAt: new Date() }).where(eq(orders.id, order.id));
    return res.status(xenditRes.status).json({ message: data.message || data.error_code || "Gagal membuat tagihan Xendit." });
  }

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
    const [paidOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    if (paidOrder?.status === "paid") await sendOrderEmail(paidOrder, "Pembayaran TuneBoss berhasil", (name) => getPaymentSuccessEmail(name, paymentDetails(paidOrder)));
  }

  if (["EXPIRED", "FAILED", "VOIDED"].includes(status) && order.status === "pending") {
    await db.update(orders).set({ paymentInvoiceStatus: parsed.data.status, updatedAt: new Date() }).where(eq(orders.id, order.id));
    const cancelled = await cancelPendingOrder(order, `Payment ${status.toLowerCase()} for order ${order.id}`);
    if (cancelled) await sendOrderEmail(cancelled, "Pembayaran TuneBoss kedaluwarsa", (name) => getPaymentExpiredEmail(name, paymentDetails(cancelled)));
  }

  return res.json({ ok: true });
});
