import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/client.js";
import { session, user } from "./db/schema.js";

const cookieName = "tuneboss_session";
const sessionMs = 1000 * 60 * 60 * 24 * 30;

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1),
});

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
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

function setSessionCookie(res: Response, token: string) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    maxAge: sessionMs,
    sameSite: "lax",
    secure: false,
  });
}

async function createSession(res: Response, userId: string, req: Request) {
  const token = randomBytes(32).toString("hex");
  await db.insert(session).values({
    id: randomUUID(),
    expiresAt: new Date(Date.now() + sessionMs),
    ipAddress: req.ip,
    token,
    userAgent: req.headers["user-agent"] ?? null,
    userId,
  });
  setSessionCookie(res, token);
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
    }).returning({ email: user.email, id: user.id, name: user.name, role: user.role });

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

  await createSession(res, found.id, req);
  return res.json({ user: { email: found.email, id: found.id, name: found.name, role: found.role } });
}

export async function me(req: Request, res: Response) {
  const token = readSessionToken(req);
  if (!token) return res.status(401).json({ user: null });

  const [row] = await db
    .select({ email: user.email, id: user.id, name: user.name, role: user.role })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(and(eq(session.token, token), gt(session.expiresAt, new Date())))
    .limit(1);

  if (!row) return res.status(401).json({ user: null });
  return res.json({ user: row });
}

export async function logout(req: Request, res: Response) {
  const token = readSessionToken(req);
  if (token) await db.delete(session).where(eq(session.token, token));
  res.clearCookie(cookieName);
  return res.json({ ok: true });
}
