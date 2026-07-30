import { eq } from "drizzle-orm";
import { db, closeDb } from "./client.js";
import { categories, products as productTable } from "./schema.js";

const products = [
  ["Honda", "TB-HONDA-ECU", "Honda Motorcycle ECU", "TuneBoss Motorcycle ECU dibuat untuk tuning mesin Honda yang lebih presisi, respons gas lebih tajam, dan kontrol performa yang aman untuk harian maupun track day.", "599000", 14],
  ["Yamaha", "TB-YAMAHA-FLASH", "Yamaha ECU Flash Kit", "Kit flash untuk update map ECU Yamaha dengan proses yang rapi, cepat, dan cocok untuk kebutuhan bengkel maupun pengguna rumahan.", "299000", 20],
  ["Kawasaki", "TB-KAWASAKI-RACE", "Kawasaki Race Tuning Pack", "Paket tuning Kawasaki untuk setup balap dengan fokus pada akselerasi, kontrol limiter, dan data performa yang mudah dipantau.", "449000", 8],
  ["Suzuki", "TB-SUZUKI-STREET", "Suzuki Street Tune Pack", "Setup tuning Suzuki harian yang menjaga motor tetap nyaman dipakai, lebih responsif, dan aman setelah modifikasi ringan.", "349000", 16],
  ["Honda", "TB-HONDA-QUICKSHIFT", "Honda Quickshifter Module", "Modul quickshifter Honda untuk perpindahan gigi lebih cepat dengan feel mekanis yang konsisten.", "249000", 11],
  ["Yamaha", "TB-YAMAHA-LAUNCH", "Yamaha Launch Control", "Kontrol start Yamaha untuk menjaga rpm tetap stabil dan membantu akselerasi awal lebih konsisten.", "399000", 7],
  ["Kawasaki", "TB-KAWASAKI-LOGGER", "Kawasaki Data Logger", "Pencatat data performa Kawasaki untuk membaca karakter mesin dan membantu proses tuning berikutnya.", "199000", 18],
  ["Suzuki", "TB-SUZUKI-HARNESS", "Suzuki Wiring Harness", "Harness Suzuki untuk instalasi modul TuneBoss dengan koneksi yang aman dan mudah dirawat.", "149000", 25],
] as const;

try {
  await db.transaction(async (tx) => {
    for (const [category, sku, name, description, price, stock] of products) {
      let [savedCategory] = await tx.select().from(categories).where(eq(categories.name, category)).limit(1);
      if (!savedCategory) {
        await tx.insert(categories).values({ description: `${category} TuneBoss products`, name: category });
        [savedCategory] = await tx.select().from(categories).where(eq(categories.name, category)).limit(1);
      }

      const [savedProduct] = await tx.select().from(productTable).where(eq(productTable.sku, sku)).limit(1);
      const values = {
        categoryId: savedCategory.id,
        description,
        imageUrl: "/images/tuneboss-motorcycle-ecu.png",
        isActive: true,
        name,
        price,
        stock,
        updatedAt: new Date(),
      };
      if (savedProduct) await tx.update(productTable).set(values).where(eq(productTable.id, savedProduct.id));
      else await tx.insert(productTable).values({ ...values, sku });
    }
  });
  console.log(`Seeded ${products.length} products.`);
} finally {
  await closeDb();
}
