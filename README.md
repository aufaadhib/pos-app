# Glutong POS

Fondasi aplikasi POS untuk kafe/restoran: login staf dengan Better Auth, RBAC, Prisma 7, Neon PostgreSQL, workspace terlindungi, katalog global, dan design system responsif.

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

Public sign-up dinonaktifkan. Email verification, reset password, transaksi POS, outlet, stok, varian, modifier, gambar, dan pengelolaan staf belum termasuk milestone ini.

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

## Menjalankan aplikasi

```powershell
npm run dev
```

Route utama:

- `/sign-in` — login email dan kata sandi.
- `/workspace` — workspace semua role yang sah.
- `/catalog` — katalog global; baca untuk semua role, kelola untuk owner/manager.
- `/design-system` — referensi UI khusus owner.

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

## Script database dan auth

- `npm run db:generate` menghasilkan Prisma client ke `generated/prisma`.
- `npm run db:migrate` membuat dan menjalankan migration versioned memakai `DIRECT_URL`.
- `npm run db:studio` membuka Prisma Studio.
- `npm run auth:generate -- -y` menyelaraskan model Better Auth ke schema Prisma.
- `npm run seed:owner` membuat owner bootstrap secara aman.

Dokumentasi rujukan: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Prisma PostgreSQL](https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql), dan [Better Auth Prisma adapter](https://www.better-auth.com/docs/adapters/prisma).

Daftar tujuan, input, output, dan side effect function baru tersedia di [`docs/functions.md`](docs/functions.md).
