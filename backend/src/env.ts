import "dotenv/config";
import { z } from "zod";

export const env = z.object({
  DATABASE_URL: z.string().url(),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:4321"),
  PORT: z.coerce.number().int().positive().default(8000),
}).parse(process.env);
