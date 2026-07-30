import { migrate } from "drizzle-orm/mysql2/migrator";
import { closeDb, db } from "./client.js";

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
} finally {
  await closeDb();
}
