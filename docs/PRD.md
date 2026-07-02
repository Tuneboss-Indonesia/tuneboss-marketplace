# Product Requirements Document: TuneBoss Marketplace

## 1. Ringkasan

TuneBoss Marketplace adalah platform e-commerce untuk penjualan produk TuneBoss di Indonesia, terutama ECU motor, flash kit, quickshifter, data logger, wiring harness, dan aksesori tuning performa motor. Produk ditujukan untuk pengguna motor performa, bengkel, dan komunitas racing/track day.

Project saat ini terdiri dari dua aplikasi:

- `frontend/`: Astro, React, Tailwind CSS, TypeScript.
- `backend/`: Express, TypeScript, Drizzle ORM, Neon Postgres, Zod.

PRD ini mendefinisikan arah produk lengkap berdasarkan struktur dan fitur yang sudah ada di project, sekaligus memisahkan fitur yang sudah terlihat dari target implementasi production-ready.

## 2. Tujuan Produk

- Menyediakan katalog produk TuneBoss yang mudah ditemukan, jelas, dan dipercaya pembeli.
- Mempercepat alur beli dari lihat produk sampai pembayaran.
- Memberikan pengalaman premium sesuai positioning TuneBoss sebagai brand performa motor.
- Menyediakan fondasi backend untuk autentikasi, katalog, stok, pesanan, dan pembayaran.
- Memungkinkan customer melacak pesanan dan mengelola akun.
- Memungkinkan admin/staff mengelola produk, stok, dan pesanan pada fase berikutnya.

## 3. Target Pengguna

### Customer

Pembeli produk TuneBoss, termasuk pemilik motor, komunitas performa, dan pengguna harian yang ingin upgrade ECU atau aksesori tuning.

Kebutuhan utama:

- Melihat produk yang cocok untuk brand motor.
- Membandingkan harga, stok, deskripsi, dan ulasan.
- Membeli dengan checkout sederhana.
- Membayar via payment gateway.
- Melacak status pesanan.
- Mengelola profil, alamat, dan riwayat pembelian.

### Staff

Tim operasional TuneBoss yang membantu proses pesanan, pengemasan, update status, dan stok.

Kebutuhan utama:

- Melihat pesanan masuk.
- Mengubah status pesanan.
- Mencatat pergerakan stok.
- Mengakses informasi customer dan pengiriman.

### Admin

Pemilik/manager marketplace.

Kebutuhan utama:

- Mengelola produk, kategori, harga, stok, dan status aktif produk.
- Mengelola user dan role.
- Melihat performa penjualan dan inventori.
- Mengatur konten legal, SEO, dan integrasi payment/shipping.

## 4. Kondisi Project Saat Ini

### Frontend Yang Sudah Ada

- Homepage dengan hero, value proposition, produk unggulan, dan testimonial.
- Katalog produk `/products` dengan search UI, filter brand, sorting, dan pagination client-side.
- Detail produk `/products/[slug]` dengan galeri, zoom/lightbox, harga, stok, deskripsi, rating, review, produk terkait, dan tombol tambah keranjang.
- Keranjang `/cart` berbasis `localStorage` dengan pilih item, ubah jumlah, hapus item, subtotal, dan checkout.
- Checkout `/checkout` dengan alamat pengiriman, validasi Zod, integrasi pencarian wilayah/kode pos, geolocation, peta Leaflet/OpenStreetMap, terms checkbox, dan create invoice Xendit.
- Status checkout `/checkout/[id]` untuk pending, success, failed, dan canceled.
- Tracking `/tracking` dengan validasi order ID dan simulasi timeline pesanan.
- Auth modal login, register, OTP, forgot password, dan logout berbasis state client.
- Account pages: profile/settings, address, purchase history.
- Dark mode, bilingual ID/EN, SEO component, schema.org, sitemap/robots support.

### Backend Yang Sudah Ada

- Health check `GET /api/health`.
- Auth endpoints: register, login, me, logout.
- Session table dan cookie `tuneboss_session`.
- Password hashing memakai `scryptSync` dan token session random.
- Products endpoint `GET /api/products`.
- Database schema untuk user, session, categories, products, stock movements, orders, order items.
- Role user: `admin`, `staff`, `customer`.
- Order status: `draft`, `pending`, `paid`, `cancelled`, `fulfilled`.

### Gap Utama

- Frontend auth masih memakai cookie simulasi `tuneboss-auth`, belum tersambung ke backend session `tuneboss_session`.
- Produk frontend masih banyak memakai array statis, belum mengambil data dari `GET /api/products`.
- Cart masih client-only, belum tersimpan ke server.
- Checkout belum membuat record `orders` dan `order_items` di backend.
- Xendit invoice ada di Astro API route frontend, belum terhubung dengan order lifecycle backend/webhook.
- Tracking dan history masih simulasi, belum membaca data order real.
- Belum ada admin/staff dashboard.

## 5. Scope Produk

### MVP Production

- Customer dapat register, login, logout, dan melihat session aktif.
- Customer dapat melihat katalog produk real dari backend.
- Customer dapat melihat detail produk real dari backend.
- Customer dapat menambahkan produk ke cart dan checkout.
- Customer dapat memilih/menambahkan alamat pengiriman.
- Sistem membuat order pending dengan order items.
- Sistem membuat invoice Xendit untuk total pesanan.
- Sistem menerima payment status dan memperbarui status order.
- Customer dapat melihat status checkout dan tracking berdasarkan order ID.
- Customer dapat melihat riwayat pembelian.
- Admin/staff minimal dapat mengelola produk dan update status pesanan lewat endpoint/API internal.

### Di Luar MVP

- Marketplace multi-seller.
- Promo/voucher kompleks.
- Loyalty points.
- Chat customer support real-time.
- Recommendation engine.
- Multi-warehouse.
- Full analytics dashboard.
- Mobile app native.

## 6. User Journey Utama

### Browse To Checkout

1. Customer membuka homepage.
2. Customer melihat produk unggulan atau membuka katalog.
3. Customer mencari/filter produk berdasarkan brand, harga, dan ketersediaan.
4. Customer membuka detail produk.
5. Customer memilih jumlah dan menambahkan ke keranjang.
6. Customer membuka cart, memilih item yang ingin dibeli, dan melanjutkan checkout.
7. Customer login/register bila belum login.
8. Customer memilih atau menambahkan alamat pengiriman.
9. Customer menyetujui syarat pengiriman.
10. Sistem membuat order dan invoice pembayaran.
11. Customer diarahkan ke Xendit.
12. Setelah pembayaran, customer kembali ke halaman status checkout.

### Tracking Order

1. Customer membuka halaman tracking.
2. Customer memasukkan order ID.
3. Sistem memvalidasi format order ID.
4. Sistem menampilkan status order dan timeline.
5. Jika order tidak ditemukan, sistem menampilkan state tidak ditemukan.

### Account Management

1. Customer login.
2. Customer membuka account settings.
3. Customer mengubah nama, nomor telepon, atau password.
4. Customer mengelola alamat.
5. Customer melihat riwayat pembelian dan membuka tracking/status order.

## 7. Kebutuhan Fungsional

### 7.1 Autentikasi

Requirements:

- User dapat register dengan nama, email, password, dan persetujuan terms/privacy.
- Email harus unik dan valid.
- Password minimal 8 karakter untuk konsisten dengan backend saat ini.
- Setelah register/login sukses, backend membuat session dan mengirim cookie httpOnly.
- User dapat logout dan session dihapus dari database.
- Frontend harus memakai endpoint backend, bukan cookie simulasi.
- Halaman protected harus memvalidasi session real.

Acceptance criteria:

- Register email baru menghasilkan user role `customer` dan session aktif.
- Register email yang sudah ada mengembalikan error jelas.
- Login credential salah mengembalikan error tanpa membocorkan detail.
- `GET /api/auth/me` mengembalikan user aktif bila cookie valid.
- Logout menghapus session dan mengembalikan user ke guest state.

### 7.2 Katalog Produk

Requirements:

- Produk berasal dari database `products`.
- Produk hanya tampil bila `isActive = true`.
- Katalog mendukung pagination.
- Katalog mendukung search by name/SKU/description.
- Katalog mendukung filter category/brand bila data brand sudah dimodelkan.
- Katalog mendukung sort newest, oldest, price low-high, price high-low.
- Produk menampilkan nama, SKU, harga, stok, gambar, dan status ketersediaan.

Acceptance criteria:

- `GET /api/products` dapat memberi daftar produk aktif.
- Frontend tidak perlu array produk statis untuk katalog production.
- Produk out of stock tetap dapat tampil, tetapi tombol beli disabled atau memberi pesan stok habis.

### 7.3 Detail Produk

Requirements:

- Detail produk dapat dibuka via slug atau ID.
- Detail menampilkan nama, brand/category, harga, stok, deskripsi, gambar, tag/spec, rating/review, dan produk terkait.
- Tombol add to cart menghormati batas stok.
- Product SEO schema tetap dipertahankan.

Acceptance criteria:

- URL produk valid menampilkan detail produk.
- URL produk invalid menampilkan 404.
- Quantity tidak dapat melebihi stok.
- Produk tidak aktif tidak bisa dibeli.

### 7.4 Cart

Requirements:

- Customer dapat menambah, menghapus, memilih, dan mengubah jumlah item.
- Cart menghitung subtotal berdasarkan item terpilih.
- Cart harus tetap berjalan untuk guest di client, tetapi divalidasi ulang saat checkout.
- Saat checkout, backend harus memvalidasi harga dan stok dari database, bukan dari payload client.

Acceptance criteria:

- Cart kosong menampilkan empty state.
- Cart berisi item menampilkan ringkasan dan tombol checkout.
- Quantity dikunci minimal 1 dan maksimal stok produk.
- Checkout menolak item yang stoknya kurang atau produk tidak aktif.

### 7.5 Alamat Pengiriman

Requirements:

- Customer dapat menyimpan beberapa alamat.
- Alamat mencakup nama penerima, nomor telepon, provinsi, kota/kabupaten, kecamatan/kelurahan, kode pos, nama jalan, detail alamat, latitude, longitude.
- Customer dapat memilih alamat saat checkout.
- Customer dapat edit dan hapus alamat.
- Validasi wajib dilakukan di frontend dan backend.

Acceptance criteria:

- Alamat tidak bisa disimpan tanpa nama, nomor telepon valid, wilayah, jalan, dan koordinat bila mode peta diwajibkan.
- Alamat checkout tersimpan ke order sebagai snapshot agar tidak berubah jika user mengedit alamat setelah order dibuat.

### 7.6 Checkout Dan Order

Requirements:

- Checkout hanya dapat dilakukan user login.
- Sistem membuat order dengan status `pending`.
- Order menyimpan customer, item, quantity, unit price saat checkout, total, alamat snapshot, shipping method/cost, dan payment reference.
- Stok harus divalidasi saat order dibuat.
- Pengurangan stok dilakukan saat pembayaran sukses atau saat order dibuat dengan strategi reservasi yang jelas.
- Order ID publik harus mudah dilacak, misalnya `INV-YYYYMMDD-XXXX` atau `TB-XXXXXXXX`.

Acceptance criteria:

- Order tidak dibuat jika cart kosong.
- Order tidak dibuat jika alamat belum dipilih.
- Total order dihitung server-side.
- Response create order mengembalikan order ID dan invoice URL.

### 7.7 Pembayaran Xendit

Requirements:

- Sistem membuat invoice Xendit dengan external ID order.
- Redirect success/failure kembali ke `/checkout/[id]`.
- Sistem harus menerima webhook Xendit untuk status pembayaran final.
- Status payment harus memutakhirkan status order.
- Payment API key tidak boleh terekspos ke client.

Acceptance criteria:

- Invoice berhasil dibuat untuk order valid.
- Jika Xendit gagal, order tetap pending atau failed sesuai strategi dan error tampil jelas.
- Webhook sukses mengubah order `pending` menjadi `paid`.
- Webhook expired/cancelled/failed mengubah order ke status sesuai.

### 7.8 Tracking Pesanan

Requirements:

- Customer dapat melacak order dengan order ID.
- Tracking menampilkan status: pending payment, paid, processing, shipped, delivered, cancelled/failed.
- Tracking menampilkan timestamp penting dan informasi pengiriman bila tersedia.
- Untuk guest tracking, sistem hanya menampilkan informasi minimal.
- Untuk logged-in owner, sistem menampilkan detail lebih lengkap.

Acceptance criteria:

- Order ID valid menampilkan timeline real.
- Order ID tidak ditemukan menampilkan not found state.
- Format order ID invalid ditolak sebelum request.

### 7.9 Riwayat Pembelian

Requirements:

- Customer dapat melihat daftar order miliknya.
- Customer dapat filter berdasarkan status.
- Customer dapat search berdasarkan order ID.
- Customer dapat membuka detail/status order.
- Customer dapat memberi review hanya untuk order delivered.

Acceptance criteria:

- User hanya melihat order miliknya sendiri.
- Tombol bayar sekarang hanya tampil untuk order pending.
- Tombol pesanan diterima hanya tampil untuk order shipped.
- Review hanya dapat dibuat sekali per produk/order item.

### 7.10 Account Settings

Requirements:

- Customer dapat mengubah nama dan nomor telepon.
- Email tidak dapat diubah pada MVP.
- Customer dapat mengubah password dengan current password.
- Semua perubahan tervalidasi dan tersimpan di backend.

Acceptance criteria:

- Password baru dan konfirmasi harus cocok.
- Current password wajib benar.
- User mendapat feedback sukses/gagal.

### 7.11 Admin/Staff Management

Requirements MVP internal:

- Admin dapat membuat, mengubah, menonaktifkan produk.
- Admin dapat membuat kategori.
- Admin/staff dapat melihat order dan update status fulfillment.
- Admin/staff dapat mencatat stock movement `in`, `out`, atau `sale`.
- Role customer tidak dapat mengakses endpoint admin/staff.

Acceptance criteria:

- Endpoint admin dilindungi role.
- Perubahan stok menghasilkan record `stock_movements`.
- Produk nonaktif tidak muncul di katalog publik.

## 8. Data Model Target

### Sudah Ada

- `user`: id, name, email, emailVerified, image, passwordHash, role, timestamps.
- `session`: id, token, expiresAt, ipAddress, userAgent, userId.
- `categories`: id, name, description, timestamps.
- `products`: id, categoryId, sku, name, description, imageUrl, price, stock, isActive, timestamps.
- `stock_movements`: id, productId, type, quantity, note, createdAt.
- `orders`: id, customerId, status, total, timestamps.
- `order_items`: id, orderId, productId, quantity, unitPrice.

### Perlu Ditambahkan

- `addresses`: customerId, recipientName, phone, province, city, district, postalCode, street, detail, latitude, longitude, isPrimary.
- `payments`: orderId, provider, providerInvoiceId, providerExternalId, invoiceUrl, status, paidAt, expiredAt, rawPayload.
- `order_shipping`: orderId, recipient snapshot, shippingMethod, shippingCost, trackingNumber, shippedAt, deliveredAt.
- `product_images` atau field images jika produk membutuhkan galeri lebih dari satu gambar.
- `product_reviews`: orderItemId, productId, customerId, rating, comment, createdAt.

## 9. API Target

### Public

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:slugOrId`
- `GET /api/categories`
- `GET /api/tracking/:orderId`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `PATCH /api/auth/profile`

### Customer

- `GET /api/addresses`
- `POST /api/addresses`
- `PATCH /api/addresses/:id`
- `DELETE /api/addresses/:id`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/pay`
- `POST /api/order-items/:id/review`

### Payment

- `POST /api/payments/xendit/invoice`
- `POST /api/webhooks/xendit`

### Admin/Staff

- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `POST /api/admin/products/:id/stock-movements`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id/status`

## 10. UX Dan UI Requirements

- Visual tetap premium, minimal, high-contrast, dan sesuai brand TuneBoss.
- Mobile-first dan desktop responsive.
- Cart drawer dan cart page harus konsisten.
- Loading state dan skeleton dipertahankan untuk katalog/detail/checkout.
- Form wajib memberi error inline yang jelas.
- Checkout harus mencegah double-submit.
- Halaman legal: privacy dan terms tetap tersedia.
- Dark mode dan bahasa ID/EN tetap didukung.
- Accessibility basic wajib: label input, aria untuk dialog/drawer, focus state, keyboard-close untuk modal.

## 11. SEO Requirements

- Homepage memiliki Organization dan WebSite schema.
- Detail produk memiliki Product dan Breadcrumb schema.
- Katalog produk punya meta title, description, keywords relevan.
- Halaman cart, checkout, account, dan status order harus `noindex`.
- Sitemap dan robots tetap aktif.
- URL produk harus stabil dan readable.

## 12. Security Requirements

- Password hash tetap memakai algoritma kuat dengan salt.
- Session cookie harus httpOnly.
- `secure` harus `true` di production HTTPS.
- CORS hanya mengizinkan origin frontend resmi.
- Semua input request divalidasi dengan Zod di backend.
- Role-based access control untuk admin/staff.
- Payment webhook harus memverifikasi signature/token Xendit.
- Total harga, stok, dan status order tidak boleh dipercaya dari client.
- API key Xendit hanya di server environment.

## 13. Performance Requirements

- Homepage dan katalog harus cepat di mobile.
- Image produk harus dioptimasi.
- Katalog harus paginated server-side saat data besar.
- Animasi tidak boleh mengganggu interaksi utama.
- API response katalog target di bawah 500 ms untuk data normal.
- Checkout create order target di bawah 2 detik di luar latensi Xendit.

## 14. Reliability Requirements

- Order creation harus idempotent atau aman dari double-click.
- Payment webhook harus bisa diproses ulang tanpa menggandakan efek stok/order.
- Perubahan status order harus tercatat dengan timestamp.
- Jika payment provider gagal, customer mendapat opsi coba lagi.
- Jika stok berubah sebelum checkout, sistem menampilkan error yang bisa dipahami.

## 15. Analytics Dan Metrics

Metrics utama:

- Product page views.
- Add to cart rate.
- Cart to checkout rate.
- Checkout completion rate.
- Payment success rate.
- Failed/expired payment rate.
- Average order value.
- Search/filter usage.
- Top selling products.
- Out-of-stock events.

## 16. Milestone Implementasi

### Milestone 1: Backend Foundation

- Finalisasi schema addresses, payments, shipping, reviews bila diperlukan.
- Tambahkan endpoint products detail dan query/filter katalog.
- Tambahkan middleware auth/session dan role guard.
- Tambahkan endpoint profile, address, order.

### Milestone 2: Frontend Integrasi Data Real

- Hubungkan login/register/logout ke backend.
- Ganti produk statis dengan API backend.
- Ganti protected route berbasis `tuneboss-auth` ke session backend.
- Validasi cart terhadap data produk real.

### Milestone 3: Checkout Dan Payment

- Pindahkan Xendit invoice ke backend.
- Buat order dan order items server-side.
- Tambahkan payment webhook.
- Hubungkan checkout status dengan order real.

### Milestone 4: Account Dan Tracking Real

- Hubungkan profile settings ke backend.
- Hubungkan address management ke backend.
- Hubungkan purchase history ke backend.
- Hubungkan tracking ke backend.

### Milestone 5: Admin/Staff Minimum

- Endpoint dan UI sederhana untuk produk.
- Endpoint dan UI sederhana untuk stok.
- Endpoint dan UI sederhana untuk order fulfillment.

## 17. Risiko Dan Mitigasi

- Risiko: frontend dan backend auth berbeda.
  Mitigasi: standardisasi pada `tuneboss_session` httpOnly dari backend.

- Risiko: harga/stok dimanipulasi dari localStorage.
  Mitigasi: hitung ulang total dan validasi stok di backend saat order dibuat.

- Risiko: payment redirect tidak selalu final.
  Mitigasi: jadikan webhook sebagai sumber kebenaran status pembayaran.

- Risiko: tracking menampilkan data sensitif untuk order ID publik.
  Mitigasi: guest tracking hanya tampilkan status minimal; detail lengkap wajib login sebagai pemilik order.

- Risiko: integrasi geolocation dan third-party wilayah tidak stabil.
  Mitigasi: alamat tetap bisa diinput manual; API wilayah/peta bersifat bantuan, bukan satu-satunya cara.

## 18. Open Questions

- Apakah TuneBoss membutuhkan pengiriman kurir real dengan ongkir dinamis atau sementara ongkir flat/free shipping?
- Apakah checkout wajib login, atau guest checkout tetap didukung?
- Format order ID final: `TB-XXXXXXXX` atau `INV-YYYYMMDD-XXXX`?
- Apakah email OTP benar-benar wajib, atau cukup email/password untuk MVP?
- Apakah produk perlu varian berdasarkan brand motor/model/tahun?
- Apakah admin dashboard harus dibangun di frontend yang sama atau cukup endpoint internal dulu?

## 19. Definition Of Done MVP

- Customer dapat register/login/logout memakai backend session.
- Produk katalog dan detail berasal dari database.
- Cart dapat checkout dan divalidasi server-side.
- Order dan order items tersimpan di database.
- Xendit invoice dibuat dari backend.
- Webhook Xendit memperbarui status order.
- Customer dapat melihat checkout status, tracking, dan history real.
- Address management tersimpan di database.
- Basic admin/staff endpoint untuk produk, stok, dan order tersedia.
- Lint, typecheck, dan build frontend/backend berhasil.
