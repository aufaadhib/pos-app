# Glutong POS

Fondasi aplikasi POS untuk kafe/restoran: login staf dengan Better Auth, RBAC, Prisma 7, Neon PostgreSQL, workspace terlindungi, katalog master multi-outlet, transaksi outlet, varian, modifier, penugasan staf, dan design system responsif.

## Menyiapkan Neon

1. Masuk ke [Neon Console](https://console.neon.tech/) dan buat project bernama **Glutong POS**.
2. Pilih provider **AWS** dan region **Asia Pacific (Singapore)**.
3. Pertahankan branch utama untuk environment production, lalu buat branch bernama `development` untuk pekerjaan lokal.
4. Dari **Connect**, salin connection string branch `development`:
   - URL dengan host yang memuat `-pooler` menjadi `DATABASE_URL` untuk runtime.
   - URL direct/non-pooled menjadi `DIRECT_URL` untuk migration Prisma.
5. Salin `.env.example` menjadi `.env`, lalu isi seluruh nilai rahasia. Jangan commit `.env`.

Gunakan secret acak minimal 32 karakter untuk Better Auth. Contoh membuatnya dari terminal:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Inisialisasi database dan owner

```powershell
npm install
npm run db:generate
npm run db:migrate -- --name initialize_auth
npm run seed:owner
```

Seed hanya berjalan jika database kosong. Jika hanya owner dengan email yang sama sudah tersedia, seed menjadi no-op. Jika ada akun berbeda, seed berhenti agar tidak mengambil alih database. Setelah seed berhasil, hapus `INITIAL_OWNER_PASSWORD` dari environment.

Public sign-up dinonaktifkan. Email verification mandiri, shift, stok, void/refund, dan gambar belum termasuk milestone ini.

## Katalog produk

Migration `add_catalog` menambahkan kategori, produk, harga dasar Rupiah bertipe `Decimal(12,2)`, dan audit log. Jalankan migration versioned pada environment baru:

```powershell
npm run db:migrate
```

Aturan utamanya:

- Owner dan manager dapat mengelola katalog; kasir hanya melihat data aktif.
- Nama kategori unik tanpa membedakan kapitalisasi. Nama produk unik di dalam kategorinya.
- SKU opsional, dinormalisasi uppercase, dan unik secara global.
- Tidak ada hard delete melalui aplikasi. Kategori hanya dapat diarsipkan setelah seluruh produknya diarsipkan.
- Semua mutation dan audit log disimpan dalam transaction database yang sama.
- Daftar `/catalog` bersifat dynamic dan tidak memakai persistent cache.

Migration `add_advanced_catalog` menambahkan katalog master dengan grup varian multi-level, pustaka modifier reusable, override harga/ketersediaan outlet, serta konfigurasi pajak dan layanan per outlet. Jalankan `npm run db:migrate` setelah menarik perubahan schema.

- Owner mengelola kategori, produk, varian, modifier, dan katalog master.
- Manager hanya mengelola harga serta ketersediaan pada outlet penugasannya.
- Kasir hanya membaca menu efektif untuk outlet session aktif.
- Tanpa override, produk lama tetap tersedia dan memakai harga master.
- Varian memilih satu opsi per grup; modifier mendukung minimum/maksimum pilihan.
- Pajak dan layanan ditampilkan sebagai konfigurasi outlet. Perhitungan total dilakukan pada milestone transaksi.

## Transaksi POS

Migration `add_pos_transactions` menambahkan struk berurutan harian per outlet, snapshot item/varian/modifier, pembayaran, dan audit transaksi.

- `/pos` membaca menu serta harga outlet secara fresh dan menyimpan cart sementara di browser.
- Checkout selalu menghitung ulang harga, ketersediaan, varian, dan batas modifier di server.
- Penjualan, nomor struk, item, pembayaran, dan audit disimpan dalam satu database transaction.
- Metode pembayaran MVP: tunai, QRIS, kartu debit, kartu kredit, dan transfer bank tanpa gateway.
- Tunai menyimpan uang diterima dan kembalian. Satu transaksi hanya memakai satu metode pembayaran.
- Dine-in wajib memiliki nomor/nama meja; takeaway tidak menyimpan meja.
- Pajak serta layanan memakai `Decimal` dan dibulatkan half-up ke Rupiah per komponen.
- Belum ada diskon, split payment, order tertahan, shift wajib, pengurangan stok, atau hard delete transaksi.

## Menjalankan aplikasi

```powershell
npm run dev
```

Route utama:

- `/sign-in` — login email dan kata sandi.
- `/workspace` — workspace semua role yang sah.
- `/pos` — register kasir untuk outlet aktif.
- `/transactions` — riwayat struk outlet aktif.
- `/transactions/[saleId]` — rincian snapshot transaksi yang sudah dibayar.
- `/catalog` — katalog master untuk owner dan menu outlet efektif untuk manager/kasir.
- `/catalog/products/[productId]` — editor varian dan pemasangan modifier khusus owner.
- `/catalog/modifiers` — pustaka modifier reusable khusus owner.
- `/outlets` — directory outlet; owner mengelola, role lain melihat cakupan masing-masing.
- `/staff` — roster staf; owner mengelola manager/kasir, manager mengelola kasir pada outlet tugasnya.
- `/select-outlet` — memilih konteks outlet aktif untuk session.
- `/change-password` — penggantian wajib untuk password sementara.
- `/design-system` — referensi UI khusus owner.

## Outlet dan staf

Migration `add_outlets_staff` menambahkan outlet, penugasan user-outlet, outlet aktif pada session, kewajiban ganti password, dan audit administratif. Aturan utamanya:

- Hanya owner yang dapat membuat, mengubah, mengarsipkan, atau memulihkan outlet.
- Manager dapat ditugaskan ke beberapa outlet; kasir wajib tepat satu outlet.
- Manager hanya dapat mengelola kasir di outlet yang juga ditugaskan kepadanya.
- Staf baru menerima password sementara 16 karakter yang hanya tampil sekali dan wajib diganti saat login pertama.
- Nonaktifkan staf dan reset password mencabut seluruh session; akun tidak dihapus permanen.
- Provinsi serta kabupaten/kota diverifikasi melalui `wilayah.web.id`; alamat jalan tetap opsional.
- Perubahan outlet, staf, penugasan, password, dan outlet aktif dicatat pada audit database.

## Quality checks

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Smoke test Better Auth memerlukan database Neon dan `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD`. Test pembatasan role juga menerima pasangan `E2E_MANAGER_EMAIL` / `E2E_MANAGER_PASSWORD` dan `E2E_CASHIER_EMAIL` / `E2E_CASHIER_PASSWORD`. Journey mutation katalog hanya berjalan jika `E2E_CATALOG_MUTATIONS=true`; fixture dibersihkan langsung dari database test setelah skenario. Tanpa nilai tersebut, skenario live dilewati; pengujian redirect anonim, tema, unit, dan komponen tetap berjalan.

Untuk menjalankan matrix role dan mutation katalog dengan akun sementara pada branch Neon development/test:

```powershell
$env:E2E_ALLOW_TEST_USERS="true"
npm run test:e2e:catalog-live
```

Runner membuat akun owner/manager/kasir acak, tidak menampilkan password, dan menghapus akun serta fixture katalog ketika selesai. Jangan aktifkan flag ini pada database production.

Untuk menguji outlet, penugasan staf, pembatasan manager/kasir, serta mengambil screenshot responsif:

```powershell
$env:E2E_ALLOW_TEST_USERS="true"
npm run test:e2e:admin-live
```

Runner admin membuat dua outlet dan tiga akun sementara, menjalankan journey CRUD/authorization, menyimpan screenshot ke `.artifacts/admin`, lalu membersihkan seluruh fixture.

## Script database dan auth

- `npm run db:generate` menghasilkan Prisma client ke `generated/prisma`.
- `npm run db:migrate` membuat dan menjalankan migration versioned memakai `DIRECT_URL`.
- `npm run db:studio` membuka Prisma Studio.
- `npm run auth:generate -- -y` menyelaraskan model Better Auth ke schema Prisma.
- `npm run seed:owner` membuat owner bootstrap secara aman.

Dokumentasi rujukan: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Prisma PostgreSQL](https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql), dan [Better Auth Prisma adapter](https://www.better-auth.com/docs/adapters/prisma).

Daftar tujuan, input, output, dan side effect function baru tersedia di [`docs/functions.md`](docs/functions.md).
