import postgres from "postgres";
import { env } from "../env.js";

const sql = postgres(env.DATABASE_URL, { prepare: false });

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
  await sql.begin(async (tx) => {
    for (const [name] of products) {
      await tx`
        insert into categories (name, description)
        values (${name}, ${`${name} TuneBoss products`})
        on conflict (name) do nothing
      `;
    }

    for (const [category, sku, name, description, price, stock] of products) {
      await tx`
        insert into products (category_id, sku, name, description, image_url, price, stock, is_active)
        values ((select id from categories where name = ${category}), ${sku}, ${name}, ${description}, ${"/images/tuneboss-motorcycle-ecu.png"}, ${price}, ${stock}, true)
        on conflict (sku) do update set
          category_id = excluded.category_id,
          name = excluded.name,
          description = excluded.description,
          image_url = excluded.image_url,
          price = excluded.price,
          stock = excluded.stock,
          is_active = excluded.is_active,
          updated_at = now()
      `;
    }
  });
  console.log(`Seeded ${products.length} products.`);
} finally {
  await sql.end();
}
