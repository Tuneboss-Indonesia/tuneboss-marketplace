import { randomUUID } from "node:crypto";
import { boolean, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

const uuid = (name: string) => varchar(name, { length: 36 }).$defaultFn(() => randomUUID());

export const user = mysqlTable("user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }).notNull().default(""),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: varchar("image", { length: 2048 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "staff", "customer"]).notNull().default("customer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = mysqlTable("session", {
  id: varchar("id", { length: 36 }).primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: varchar("user_agent", { length: 512 }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => user.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailVerificationTokens = mysqlTable("email_verification_tokens", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => user.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const addresses = mysqlTable("addresses", {
  id: uuid("id").primaryKey(),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => user.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 100 }).notNull().default("Rumah"),
  recipientName: varchar("recipient_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  addressLine: text("address_line").notNull(),
  city: varchar("city", { length: 128 }).notNull().default(""),
  province: varchar("province", { length: 128 }).notNull().default(""),
  postalCode: varchar("postal_code", { length: 16 }).notNull().default(""),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const categories = mysqlTable("categories", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description").notNull().$defaultFn(() => ""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const products = mysqlTable("products", {
  id: uuid("id").primaryKey(),
  categoryId: varchar("category_id", { length: 36 }).references(() => categories.id, { onDelete: "set null" }),
  sku: varchar("sku", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull().$defaultFn(() => ""),
  imageUrl: varchar("image_url", { length: 2048 }),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  stock: int("stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productImages = mysqlTable("product_images", {
  id: uuid("id").primaryKey(),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  imageUrl: varchar("image_url", { length: 2048 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stockMovements = mysqlTable("stock_movements", {
  id: uuid("id").primaryKey(),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["in", "out", "sale"]).notNull(),
  quantity: int("quantity").notNull(),
  note: varchar("note", { length: 1000 }).notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: uuid("id").primaryKey(),
  actorId: varchar("actor_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
  action: varchar("action", { length: 255 }).notNull(),
  targetId: varchar("target_id", { length: 128 }).notNull().default(""),
  targetType: varchar("target_type", { length: 128 }).notNull(),
  payload: json("payload").notNull().$defaultFn(() => ({})),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storeContent = mysqlTable("store_content", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: json("value").notNull().$defaultFn(() => ({})),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orders = mysqlTable("orders", {
  id: uuid("id").primaryKey(),
  customerId: varchar("customer_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
  addressId: varchar("address_id", { length: 36 }).references(() => addresses.id, { onDelete: "set null" }),
  courier: varchar("courier", { length: 128 }).notNull().default(""),
  deliveredAt: timestamp("delivered_at"),
  paymentExpiresAt: timestamp("payment_expires_at"),
  paymentInvoiceId: varchar("payment_invoice_id", { length: 255 }).notNull().default(""),
  paymentInvoiceStatus: varchar("payment_invoice_status", { length: 64 }).notNull().default(""),
  paymentInvoiceUrl: varchar("payment_invoice_url", { length: 2048 }).notNull().default(""),
  shippedAt: timestamp("shipped_at"),
  shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  shippingMethod: varchar("shipping_method", { length: 64 }).notNull().default("REGULAR"),
  status: mysqlEnum("status", ["draft", "pending", "paid", "cancelled", "fulfilled"]).notNull().default("pending"),
  stockReserved: boolean("stock_reserved").notNull().default(false),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  trackingNumber: varchar("tracking_number", { length: 255 }).notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productReviews = mysqlTable("product_reviews", {
  id: uuid("id").primaryKey(),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  rating: int("rating").notNull().default(5),
  quote: text("quote").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("product_reviews_customer_unique").on(table.productId, table.customerId),
]);

export const orderItems = mysqlTable("order_items", {
  id: uuid("id").primaryKey(),
  orderId: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
});

export const paymentEvents = mysqlTable("payment_events", {
  id: uuid("id").primaryKey(),
  orderId: varchar("order_id", { length: 36 }).references(() => orders.id, { onDelete: "set null" }),
  provider: varchar("provider", { length: 64 }).notNull().default("xendit"),
  eventType: varchar("event_type", { length: 128 }).notNull(),
  status: varchar("status", { length: 64 }).notNull().default(""),
  externalId: varchar("external_id", { length: 255 }).notNull().default(""),
  providerReference: varchar("provider_reference", { length: 255 }),
  payload: json("payload").notNull().$defaultFn(() => ({})),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("payment_events_provider_reference_unique").on(table.providerReference),
]);
