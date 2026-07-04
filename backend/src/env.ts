import "dotenv/config";
import { z } from "zod";

export const env = z.object({
  DATABASE_URL: z.string().url(),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:4321"),
  PORT: z.coerce.number().int().positive().default(8000),
  CRON_SECRET: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().optional(),
}).parse(process.env);
