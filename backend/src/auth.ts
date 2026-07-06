import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/client.js";
import { session, user } from "./db/schema.js";
import { env } from "./env.js";

const cookieName = "tuneboss_session";
const customerSessionMs = 1000 * 60 * 60 * 24 * 30;
const staffSessionMs = 1000 * 60 * 60 * 12;

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1),
});

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function readSessionToken(req: Request) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return match ? decodeURIComponent(match.slice(cookieName.length + 1)) : null;
}

export async function currentUser(req: Request) {
  const token = readSessionToken(req);
  if (!token) return null;

  const [row] = await db
    .select({ email: user.email, emailVerified: user.emailVerified, id: user.id, name: user.name, phone: user.phone, role: user.role })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(and(eq(session.token, token), gt(session.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
}

function setSessionCookie(res: Response, token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" || !env.FRONTEND_ORIGIN.startsWith("http://localhost");
  res.cookie(cookieName, token, {
    httpOnly: true,
    maxAge,
    sameSite: secure ? "none" : "lax",
    secure,
  });
}

async function createSession(res: Response, userId: string, req: Request, maxAge = customerSessionMs) {
  const token = randomBytes(32).toString("hex");
  await db.insert(session).values({
    id: randomUUID(),
    expiresAt: new Date(Date.now() + maxAge),
    ipAddress: req.ip,
    token,
    userAgent: req.headers["user-agent"] ?? null,
    userId,
  });
  setSessionCookie(res, token, maxAge);
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const id = randomUUID();
    const [created] = await db.insert(user).values({
      id,
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: hashPassword(parsed.data.password),
    }).returning({ email: user.email, emailVerified: user.emailVerified, id: user.id, name: user.name, phone: user.phone, role: user.role });

    await createSession(res, id, req);
    return res.status(201).json({ user: created });
  } catch {
    return res.status(409).json({ message: "Email sudah terdaftar." });
  }
}

export async function login(req: Request, res: Response) {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const [found] = await db.select().from(user).where(eq(user.email, parsed.data.email)).limit(1);
  if (!found || !verifyPassword(parsed.data.password, found.passwordHash)) {
    return res.status(401).json({ message: "Email atau password salah." });
  }

  await createSession(res, found.id, req, found.role === "admin" || found.role === "staff" ? staffSessionMs : customerSessionMs);
  return res.json({ user: { email: found.email, emailVerified: found.emailVerified, id: found.id, name: found.name, phone: found.phone, role: found.role } });
}

export async function me(req: Request, res: Response) {
  const found = await currentUser(req);
  if (!found) return res.status(401).json({ user: null });
  return res.json({ user: found });
}

export async function logout(req: Request, res: Response) {
  const token = readSessionToken(req);
  if (token) await db.delete(session).where(eq(session.token, token));
  res.clearCookie(cookieName);
  return res.json({ ok: true });
}
