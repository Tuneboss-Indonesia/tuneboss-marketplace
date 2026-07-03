import { boolean, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "staff", "customer"]);
export const stockMovementType = pgEnum("stock_movement_type", ["in", "out", "sale"]);
export const orderStatus = pgEnum("order_status", ["draft", "pending", "paid", "cancelled", "fulfilled"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("customer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Rumah"),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  addressLine: text("address_line").notNull(),
  city: text("city").notNull().default(""),
  province: text("province").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  type: stockMovementType("type").notNull(),
  quantity: integer("quantity").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id").references(() => user.id, { onDelete: "set null" }),
  addressId: uuid("address_id").references(() => addresses.id, { onDelete: "set null" }),
  courier: text("courier").notNull().default(""),
  deliveredAt: timestamp("delivered_at"),
  paymentExpiresAt: timestamp("payment_expires_at"),
  shippedAt: timestamp("shipped_at"),
  status: orderStatus("status").notNull().default("pending"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  trackingNumber: text("tracking_number").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
});

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("xendit"),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default(""),
  externalId: text("external_id").notNull().default(""),
  providerReference: text("provider_reference").notNull().default(""),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
