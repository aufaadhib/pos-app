<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Stack Rules

1. Gunakan Next.js 16 App Router dan pertahankan TypeScript dalam mode strict.
2. Gunakan npm sebagai satu-satunya package manager dan pertahankan `package-lock.json` sebagai lockfile proyek.
3. Gunakan Tailwind CSS v4 dan shadcn/ui sebagai fondasi antarmuka.
4. Gunakan PostgreSQL melalui Prisma ORM versi stabil. Jangan menggunakan Prisma Next selama masih berstatus Early Access.
5. Gunakan Better Auth dengan Prisma adapter sebagai satu-satunya library authentication.
6. Tempatkan frontend dan backend di dalam aplikasi Next.js dan repository yang sama, kecuali pengguna secara eksplisit meminta arsitektur service terpisah.

## UI Development Rules

1. Gunakan komponen shadcn/ui sebagai pilihan utama untuk antarmuka.
2. Jangan membuat ulang komponen yang sudah tersedia di shadcn/ui.
3. Gunakan Tailwind CSS untuk styling dan penyesuaian komponen.
4. Semua halaman harus responsif untuk mobile, tablet, dan desktop.
5. Pertahankan konsistensi warna, spacing, typography, dan state komponen.
6. Jika komponen shadcn/ui belum tersedia, tambahkan melalui CLI shadcn.

## Next.js Architecture Rules

1. Gunakan Server Component sebagai default. Tambahkan `"use client"` hanya pada komponen yang membutuhkan state, event handler, browser API, atau interaktivitas client-side.
2. Jaga batas Client Component sekecil mungkin dan kirimkan hanya data serializable dari Server Component.
3. Gunakan Server Actions untuk mutation yang hanya dikonsumsi oleh UI internal aplikasi.
4. Gunakan Route Handlers untuk API publik, webhook, callback authentication, atau integrasi eksternal.
5. Setiap Server Action dan Route Handler yang dilindungi wajib melakukan validasi input, session, dan permission di server.
6. Simpan Prisma Client, akses database, environment variable rahasia, dan integrasi privileged di modul server-only. Jangan mengimpornya ke Client Component.
7. Pisahkan business logic dari page, component, Server Action, Route Handler, dan query database agar dapat diuji secara independen.

## Backend and PostgreSQL Rules

1. Gunakan PostgreSQL sebagai database relasional utama.
2. Simpan kredensial database dan connection string di environment variable. Jangan pernah menulis secret langsung di source code atau melakukan commit secret ke Git.
3. Validasi seluruh environment variable yang dibutuhkan backend saat aplikasi dimulai. Hentikan proses dengan pesan error yang jelas jika ada konfigurasi wajib yang belum tersedia.
4. Akses PostgreSQL hanya melalui Prisma ORM versi stabil dan Prisma Client yang digunakan bersama. Jangan menambahkan ORM atau database client kedua tanpa persetujuan pengguna.
5. Kelola setiap perubahan schema database melalui migration yang memiliki versi. Jangan mengubah tabel production secara manual.
6. Rancang tabel dengan primary key yang eksplisit, foreign key, constraint, dan tipe data PostgreSQL yang sesuai.
7. Tambahkan index berdasarkan kebutuhan query, filter, sorting, atau relasi yang nyata. Periksa query plan sebelum menambahkan index hanya untuk optimasi performa.
8. Gunakan transaction untuk rangkaian operasi yang harus berhasil atau gagal sebagai satu kesatuan.
9. Hindari N+1 query, pengambilan data tanpa batas, dan `SELECT *`. Ambil hanya kolom yang diperlukan dan gunakan pagination untuk data yang dapat terus bertambah.
10. Gunakan Prisma query API atau parameterized raw query. Jangan membentuk SQL dengan menggabungkan input yang tidak tepercaya.
11. Gunakan format response API dan HTTP status code yang konsisten. Jangan mengekspos stack trace, SQL statement, kredensial, atau detail internal database.
12. Sediakan seed data yang aman untuk development jika diperlukan. Seed script tidak boleh menimpa data production.

## Rendering, Caching, and Revalidation Rules

1. Gunakan prinsip **dynamic by default, cache by exception** untuk aplikasi POS.
2. Gunakan Dynamic Rendering sebagai default untuk halaman operasional yang terautentikasi. Dynamic Rendering tetap dapat menggunakan Server Components dan tidak berarti data harus diambil dari browser.
3. Gunakan prerendering hanya untuk konten bersama yang tidak bergantung pada session, permission, cookie, header, atau request pengguna dan boleh disajikan dalam kondisi sedikit stale.
4. Untuk halaman kompleks, gunakan pendekatan hybrid: prerender atau cache static shell dan tampilkan bagian fresh melalui Dynamic Rendering, `<Suspense>`, dan streaming.
5. Session, permission, stok terkini, transaksi penjualan aktif, status pembayaran, dan data yang menentukan validitas transaksi wajib dirender secara dynamic dan dibaca fresh.
6. Halaman informasi, layout umum, kategori, dan konfigurasi katalog yang jarang berubah boleh diprerender atau dicache jika stale tolerance dan strategi revalidation ditentukan dengan jelas.
7. Daftar produk dan harga hanya boleh dicache jika kebutuhan bisnis menerima data stale untuk waktu tersebut dan cache diinvalidate segera setelah perubahan terkait berhasil.
8. Jangan menganggap `fetch` otomatis menggunakan persistent cache. Tentukan perilaku cache secara eksplisit berdasarkan kebutuhan freshness setiap data.
9. Selama `cacheComponents` belum diaktifkan di `next.config.ts`, gunakan model caching Next.js yang berlaku saat ini: `cache: "force-cache"` atau `next.revalidate` untuk `fetch`, dan `unstable_cache` hanya jika query Prisma benar-benar membutuhkan persistent caching.
10. Jangan menggunakan directive `"use cache"`, `cacheLife`, atau `cacheTag` sebelum `cacheComponents: true` diaktifkan secara eksplisit dan implementasinya mengikuti dokumentasi Next.js versi yang terpasang.
11. Gunakan React `cache()` hanya untuk deduplikasi pemanggilan data yang sama dalam satu server render. Jangan menganggap React `cache()` sebagai persistent cache lintas request.
12. Setiap cache wajib memiliki alasan penggunaan, cache key yang lengkap, batas waktu atau revalidation policy, tag jika diperlukan, dan jalur invalidasi setelah mutation.
13. Cache key harus mencakup seluruh input yang memengaruhi hasil, seperti ID resource, outlet, tenant, filter, tanggal, pagination, bahasa, atau mata uang yang relevan.
14. Jangan cache session, credential, permission, token, data rahasia, atau hasil authorization yang dapat digunakan kembali oleh pengguna lain.
15. Setelah create, update, void, refund, pembayaran, atau perubahan stok berhasil dan database transaction telah di-commit, invalidate hanya tag atau path yang terdampak. Utamakan tag-based invalidation daripada invalidasi path yang terlalu luas jika memungkinkan.
16. Gunakan revalidation langsung untuk alur read-your-own-writes yang harus segera menampilkan perubahan. Gunakan stale-while-revalidate hanya ketika keterlambatan data memang dapat diterima.
17. Untuk data fresh yang lambat, gunakan `<Suspense>` dan streaming dengan loading state yang bermakna, bukan menyimpan data sensitif atau transaksional ke cache hanya untuk mempercepat tampilan.
18. Uji perilaku rendering, caching, dan revalidation menggunakan production build karena perilakunya pada development dapat berbeda.

## Authentication and Authorization Rules

1. Gunakan Better Auth dengan Prisma adapter. Jangan membuat sistem authentication atau session sendiri dan jangan menambahkan library authentication kedua.
2. Gunakan session berbasis secure cookie dengan konfigurasi `HttpOnly`, `Secure` pada production, dan `SameSite` yang sesuai.
3. Terapkan RBAC dengan prinsip deny-by-default. Pengguna hanya memperoleh permission yang didefinisikan secara eksplisit.
4. Simpan definisi role, resource, action, dan permission di satu modul terpusat. Jangan menyebarkan string role atau permission di berbagai component dan route.
5. Jangan membuat role POS seperti owner, admin, kasir, atau gudang sebelum kebutuhan dan permission setiap role ditentukan oleh pengguna.
6. Setiap Server Action, Route Handler, dan operasi database yang dilindungi wajib memvalidasi session aktif dan permission di server.
7. Pemeriksaan cookie di `proxy.ts` hanya boleh digunakan untuk redirect awal. Keberadaan cookie tidak boleh dianggap sebagai bukti authentication atau authorization.
8. Jangan mengandalkan penyembunyian tombol, menu, atau validasi client-side sebagai kontrol akses.

## POS Data Integrity Rules

1. Jangan menyimpan atau menghitung nilai uang menggunakan floating point. Gunakan tipe PostgreSQL `numeric`, Prisma `Decimal`, atau representasi presisi setara.
2. Jalankan pembuatan penjualan, pembayaran, dan perubahan stok terkait di dalam satu database transaction jika semuanya merupakan satu operasi bisnis.
3. Jangan menghapus permanen transaksi finansial yang sudah tercatat. Gunakan proses void, cancellation, atau refund yang mereferensikan transaksi asal.
4. Catat audit trail untuk perubahan penting pada penjualan, pembayaran, stok, harga, dan permission pengguna.
5. Simpan timestamp secara konsisten dalam UTC dan tampilkan waktu kepada pengguna menggunakan zona waktu `Asia/Jakarta`.
6. Cegah stok negatif dan pembayaran berlebih melalui validasi business logic dan constraint database jika sesuai dengan kebutuhan bisnis.

## Code Quality Rules

1. Gunakan satu schema validation library yang konsisten untuk seluruh input server. Validasi client-side hanya untuk pengalaman pengguna dan tidak menggantikan validasi server.
2. Gunakan bahasa Inggris untuk nama file, variable, type, class, method, dan function. Gunakan Bahasa Indonesia untuk teks antarmuka pengguna.
3. Sebelum membuat tabel, kolom, relasi, query, API route, method, atau function baru, periksa implementasi yang sudah ada dan ikuti konvensi proyek.
4. Dokumentasikan setiap method atau function baru, termasuk tujuan, input, output, dan side effect pentingnya, lalu jelaskan method atau function tersebut kepada pengguna.
5. Buat test untuk business rule penting, authorization, transaction, database constraint, dan alur pengguna yang kritis.
6. Sebelum pekerjaan dianggap selesai, jalankan `npm run lint`, `npx tsc --noEmit`, `npm run build`, dan test relevan yang sudah dikonfigurasi.
7. Pastikan setiap perubahan UI tetap responsif pada mobile, tablet, dan desktop.
