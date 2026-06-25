import cors from "cors";
import express from "express";
import { desc } from "drizzle-orm";
import { login, logout, me, register } from "./auth.js";
import { db } from "./db/client.js";
import { products } from "./db/schema.js";
import { env } from "./env.js";

const app = express();

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

app.get("/api/products", async (_req, res) => {
  const rows = await db
    .select({
      id: products.id,
      imageUrl: products.imageUrl,
      name: products.name,
      price: products.price,
      sku: products.sku,
      stock: products.stock,
    })
    .from(products)
    .orderBy(desc(products.createdAt));

  res.json({ products: rows });
});

app.listen(env.PORT, () => {
  console.log(`TuneBoss API listening on http://localhost:${env.PORT}`);
});
