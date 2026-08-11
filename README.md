# Glutong POS

Fondasi aplikasi POS untuk kafe/restoran: login staf dengan Better Auth, RBAC, Prisma 7, Neon PostgreSQL, workspace terlindungi, katalog master multi-outlet, transaksi outlet, varian, modifier, laporan operasional, penugasan staf, roster, absensi wajah/lokasi, dan design system responsif.

Rencana pengembangan berikutnya tersedia di [`docs/roadmap.md`](docs/roadmap.md).

## Menyiapkan Neon

1. Masuk ke [Neon Console](https://console.neon.tech/) dan buat project bernama **Glutong POS**.
2. Pilih provider **AWS** dan region **Asia Pacific (Singapore)**.
3. Pertahankan branch utama untuk environment production, lalu buat branch bernama `development` untuk pekerjaan lokal.
4. Dari **Connect**, salin connection string branch `development`:
   - URL dengan host yang memuat `-pooler` menjadi `DATABASE_URL` untuk runtime.
   - URL direct/non-pooled menjadi `DATABASE_URL_UNPOOLED` untuk migration Prisma.
5. Salin `.env.example` menjadi `.env`, lalu isi connection string branch yang ingin digunakan. Jangan commit `.env`.

Migration production dijalankan manual memakai `npm run db:migrate:deploy`, tidak melalui Vercel build. Pastikan `DATABASE_URL` dan `DATABASE_URL_UNPOOLED` di `.env` mengarah ke branch yang benar sebelum menjalankan migration, seed, atau E2E live.

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

Public sign-up dinonaktifkan. Email verification mandiri dan stok belum termasuk milestone saat ini.

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

## Gambar produk

Migration `add_product_image` menambahkan satu URL gambar pada produk master dan action audit `IMAGE_CHANGE`. Migration `add_product_image_focal_point` menambahkan posisi fokus X/Y agar crop 1:1 tetap tepat pada setiap ukuran kartu. Gambar berlaku untuk seluruh outlet dan hanya owner yang dapat mengunggah, mengganti, mengatur posisi, atau menghapusnya dari dialog edit produk.

1. Buat public Blob store di Vercel dan hubungkan store tersebut ke project.
2. Tambahkan `BLOB_READ_WRITE_TOKEN` ke `.env` lokal dan environment deployment.
3. Jalankan `npm run db:migrate` lalu `npm run db:generate`.

Upload menerima JPEG, PNG, atau WebP. File hingga 3 MB dikirim tanpa perubahan; file yang lebih besar dikompres di browser tanpa mengganti format aslinya. Server tetap memvalidasi MIME, signature, dan hasil maksimum 3 MB. Setelah upload, tahan lalu geser foto di dalam frame crop 1:1 seperti pengaturan foto profil, kemudian simpan posisi. Token Blob divalidasi saat operasi gambar dijalankan sehingga aplikasi tetap dapat dimulai sebelum store dibuat. File runtime tidak disimpan di `public`; folder tersebut hanya untuk asset yang ikut Git/build.

## Transaksi POS

Migration `add_pos_transactions` menambahkan struk berurutan harian per outlet, snapshot item/varian/modifier, pembayaran, dan audit transaksi.

- `/pos` membaca menu serta harga outlet secara fresh dan menyimpan cart sementara di browser.
- Checkout selalu menghitung ulang harga, ketersediaan, varian, dan batas modifier di server.
- Penjualan, nomor struk, item, pembayaran, dan audit disimpan dalam satu database transaction.
- Metode pembayaran MVP: tunai, QRIS, kartu debit, kartu kredit, dan transfer bank tanpa gateway.
- Tunai menyimpan uang diterima dan kembalian. Satu transaksi hanya memakai satu metode pembayaran.
- Dine-in wajib memiliki nomor/nama meja; takeaway tidak menyimpan meja.
- Pajak serta layanan memakai `Decimal` dan dibulatkan half-up ke Rupiah per komponen.
- Belum ada diskon, split payment, pengurangan stok, atau hard delete transaksi.

### Open order dan kitchen ticket

Migration `add_open_orders_and_kitchen_tickets` menambahkan order terpadu untuk checkout langsung dan pesanan belum dibayar, optimistic version, meja aktif unik per outlet, audit, serta antrean dapur.

- Owner/manager dapat mengaktifkan “Simpan order” untuk outlet aktif melalui `/settings`; kasir hanya memakai fiturnya.
- Open order dine-in/takeaway dapat dilanjutkan semua staf yang memiliki akses outlet dan tetap aktif setelah shift pembuat ditutup.
- Catatan item dapat ditambah, diubah, atau dikosongkan langsung dari rincian pesanan. Perubahan wajib disimpan lalu dikirim manual ke dapur; tambahan, perubahan catatan, dan pengurangan menjadi delta ticket, sedangkan pengurangan/pembatalan wajib memiliki alasan.
- Open order hanya dapat dibayar setelah revisi terbaru dikirim. Sale dan pembayaran masuk ke shift aktif staf yang menyelesaikan.
- Checkout langsung, termasuk delivery platform, otomatis membuat kitchen ticket dalam transaction yang sama.
- Harga dan availability divalidasi ulang. Perubahan harga harus dikonfirmasi sebelum pembayaran dapat diulang.
- `/kitchen` memakai antrean fresh Baru → Diproses → Selesai. Printer dapur dan KDS perangkat penuh belum termasuk tahap ini.

### Printer struk browser

Migration `add_receipt_printer_settings` menambahkan ukuran kertas dan footer struk per outlet dengan default 80 mm dan “Terima kasih atas kunjungan Anda.” agar perilaku lama tetap konsisten.

- Owner dan manager membuka `/settings/printers` dari kartu **Printer struk** di Pengaturan; kasir tidak memiliki permission halaman maupun mutation.
- Ukuran 58 mm memakai area isi 52 mm, sedangkan 80 mm memakai area isi 72 mm. Preview pengaturan dan struk checkout memakai renderer yang sama.
- Footer dapat dikosongkan untuk disembunyikan. Perubahannya dibatasi ke outlet aktif dan disimpan bersama audit before/after dalam satu transaction.
- **Buka dialog cetak browser otomatis** nonaktif secara default dan disimpan per browser dengan key `glutong:printer:auto-print:<outletId>`. Status Aktif/Nonaktif hanya mengatur pembukaan dialog browser pada perangkat tersebut; jika local storage tidak tersedia, cetak kembali manual.
- Checkout selalu mempertahankan preview serta tombol **Cetak struk**. Printer fisik, jumlah salinan, dan orientasi tetap dipilih lewat dialog browser.
- Printer dapur, KDS perangkat penuh, ESC/POS, USB/LAN/Bluetooth, logo, dan jumlah salinan tersimpan belum termasuk tahap ini.

### Absensi karyawan

Migration `add_employee_attendance` menambahkan profil wajah terenkripsi, challenge sekali pakai, attempt dan foto bukti privat, sesi masuk/pulang, pengecualian, koreksi append-only, audit, serta geofence outlet. Migration `add_face_reenrollment_approval` menambahkan antrean persetujuan daftar ulang. Migration `add_staff_roles_and_rosters` menambahkan role staf terbatas, jabatan kerja, template shift, roster mingguan, snapshot jadwal, dan toleransi outlet.

- Setiap staf menggunakan akun Better Auth sendiri. Pencocokan selalu `1:1` terhadap profil akun login, bukan pencarian wajah seluruh staf.
- `/attendance` mendukung pendaftaran tiga sampel, check-in/check-out, liveness ringan, GPS maksimal 100 m, geofence 50–500 m, roster dua minggu, dan riwayat pribadi. Pendaftaran pertama langsung aktif; daftar ulang kasir/staf mempertahankan profil lama sampai salah satu owner/manager menyetujui sampel baru. Mode tablet bersama hanya menyimpan preferensi logout otomatis di browser dengan key `glutong:attendance:shared-device`.
- `/settings/attendance` menyediakan peta OpenStreetMap interaktif: pusat dan handle radius dapat digeser, lokasi perangkat dapat dipakai, dan koordinat/radius manual tetap tersinkron dua arah.
- Setelah tiga kegagalan dalam verification session 15 menit, staf dapat meminta pengecualian. `/attendance/manage` membatasi manager ke outlet penugasannya, menolak self-approval, menyediakan review daftar ulang kasir/staf, ringkasan jadwal hari ini, koreksi waktu append-only, pembatalan profil, serta ekspor CSV maksimal 10.000 baris.
- `/attendance/roster` menyediakan pengelolaan template shift per outlet, papan Senin–Minggu, draf, salin minggu lalu, dan publish. Setelah terbit, owner/manager tetap dapat mengganti shift, menambahkan shift pada hari Libur, atau mengubah shift menjadi Libur selama jadwal belum mulai dan alasan audit diisi. Satu staf hanya boleh memiliki satu shift per tanggal secara global; shift lintas tengah malam tetap memakai zona waktu outlet.
- Check-in terjadwal dapat dimulai dua jam sebelum shift. Absensi yang tidak cocok roster tetap boleh dilanjutkan setelah konfirmasi dan ditandai **Di luar jadwal**. Toleransi terlambat dan pulang cepat diatur per outlet dengan default 15 menit.
- Waktu server menjadi sumber kebenaran dan tanggal bisnis mengikuti zona outlet. Satu staf hanya dapat memiliki satu sesi terbuka; check-out wajib pada outlet check-in.
- Foto attempt disimpan pada Vercel Blob private terpisah dan cron menghapusnya setelah 30 hari. Embedding probe tidak disimpan; template aktif dan sampel daftar ulang pending dienkripsi AES-256-GCM. Payload pending dihapus setelah keputusan, sedangkan template lama baru dihapus ketika penggantian disetujui.
- Liveness browser hanya mitigasi ringan, bukan jaminan anti-spoof tingkat tinggi. Model dan threshold `0,60` wajib dikalibrasi lagi pada tablet/ponsel Android nyata sebelum dipakai sebagai dasar payroll.
- Production memerlukan `ATTENDANCE_EMBEDDING_KEY`, `ATTENDANCE_BLOB_READ_WRITE_TOKEN`, dan `CRON_SECRET`. Setelah konfigurasi, validasi koneksi private Blob dan respons `200` cleanup cron sebelum mengaktifkan absensi outlet.
- Sebelum data dipakai untuk payroll atau keputusan disipliner, lakukan pilot pada perangkat Android target dalam cahaya normal/redup, catat similarity dan false reject, uji wajah akun lain, serta pastikan GPS stabil di dalam dan di luar radius.

Siapkan private Blob store dan tiga environment khusus absensi. `ATTENDANCE_EMBEDDING_KEY` harus berupa 32 byte acak dalam base64; credential ini divalidasi hanya saat fitur absensi digunakan.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Void dan refund

Migration `add_sale_voids_and_refunds` menambahkan status transaksi serta ledger koreksi append-only tanpa mengubah snapshot struk asli.

- Owner dan manager dapat melakukan void penuh pada tanggal bisnis yang sama atau refund item/kuantitas; kasir hanya dapat melihat hasilnya.
- Refund parsial dapat diulang sampai sisa kuantitas dan nilai habis. Alasan, actor, waktu, metode asal, dan audit selalu disimpan.
- Refund tunai wajib memakai shift aktif pelaksana dan mengurangi expected cash shift tersebut. Shift asal yang sudah ditutup tidak dibuka atau diubah.
- Refund QRIS, kartu, transfer, dan platform dicatat selesai manual dengan referensi bank/provider wajib; aplikasi belum memanggil API pembayaran.
- Delivery pending hanya menyisakan nilai bersih pada settlement. Delivery settled harus melalui reversal settlement sebelum dapat direfund.
- Cancellation sebelum pembayaran dikerjakan bersama open order; pengembalian stok dikerjakan bersama stock movement.

## Shift kasir dan tutup kas

Migration `add_cash_shifts` menambahkan shift kasir, pergerakan kas, audit shift, dan relasi nullable dari transaksi lama ke shift. Migration `add_cash_shift_reconciliation_corrections` menambahkan koreksi rekonsiliasi append-only. Checkout baru oleh owner, manager, maupun kasir wajib memakai shift pribadi yang aktif pada outlet session.

- Satu user hanya dapat membuka satu shift secara global; shift tetap aktif melewati tengah malam dan tanggal bisnis mengikuti tanggal lokal saat dibuka.
- Saldo kas seharusnya dihitung dari saldo awal + penjualan tunai + kas masuk - kas keluar - refund tunai. QRIS, kartu, transfer, dan platform delivery tetap diringkas tetapi tidak masuk cash drawer.
- Input Rupiah untuk saldo, movement, hitung fisik, dan uang diterima otomatis memakai pemisah ribuan titik; server tetap menerima digit mentah dan menghitung dengan `Decimal`.
- Kasir menutup shift dengan blind count. Expected cash dan selisih baru tampil setelah penutupan berhasil.
- Owner/manager dapat menutup paksa shift dalam cakupan outlet dengan kas aktual dan alasan wajib.
- Setelah shift ditutup, owner/manager dapat memperbaiki kas aktual yang salah hitung melalui **Koreksi rekonsiliasi**. Nilai penutupan asli tidak ditimpa; revisi, nilai efektif, alasan, pelaku, waktu, dan audit tetap tersimpan.
- Riwayat, rincian shift, laporan, dan CSV memakai nilai efektif terbaru sambil tetap menampilkan nilai aktual/selisih asli ketika koreksi tersedia.
- Pergantian outlet, arsip outlet, deaktivasi staf, dan perubahan assignment diblokir selama shift terdampak masih terbuka. Logout tetap diizinkan setelah peringatan.
- `/shifts` menampilkan shift outlet aktif, riwayat, pembayaran per metode, movement, transaksi, dan audit tanpa persistent cache.

## Ojol dan settlement

Migration `add_delivery_channels_and_settlements` menambahkan harga GoFood, GrabFood, dan ShopeeFood per outlet, snapshot harga pembanding penjualan langsung, piutang platform, serta rekonsiliasi transfer secara batch.

- Owner mengatur markup, estimasi fee, waktu cair, status channel, dan override harga produk.
- Harga channel selalu di atas harga outlet dan dibulatkan naik ke Rp500; fee serta selisih tetap dihitung presisi dengan `Decimal`.
- Kasir memilih sumber order sebelum menambahkan item dan wajib memasukkan nomor order platform yang unik.
- Order platform menggunakan harga final termasuk pajak, tanpa service charge lokal, dan otomatis berstatus settlement `PENDING`.
- Owner dan manager dapat mencocokkan banyak order dalam satu transfer. Gross sudah dikurangi refund pending, lalu fee, promo merchant, dan penyesuaian harus sama persis dengan net yang masuk.
- Hanya owner yang dapat membalik settlement; batch tidak dihapus dan seluruh transaksi memperoleh audit.
- Tahap ini belum mengambil order/API atau laporan CSV langsung dari platform dan belum menghitung HPP bahan.

## Laporan operasional dan keuangan

Migration `add_report_category_snapshots` menyimpan kategori pada item penjualan baru agar laporan historis tidak berubah ketika katalog diedit. Item lama tetap masuk kelompok “Kategori belum tersimpan” karena kategori historisnya tidak boleh ditebak.

- `/reports` tersedia untuk owner dan manager; owner dapat menggabungkan semua outlet, sedangkan manager dibatasi outlet penugasannya.
- Filter hari ini, 7 hari, 30 hari, bulan berjalan, dan rentang khusus maksimum 366 hari tersimpan di URL.
- Paket laporan mencakup ringkasan harian, produk/kategori, metode pembayaran, shift, refund/void, dan settlement.
- Net sales memakai penjualan bruto dikurangi refund/void pada tanggal koreksi dijalankan agar cocok dengan aktivitas shift dan pembayaran.
- Setiap tampilan dapat diekspor sebagai CSV UTF-8 yang dibatasi permission, outlet, rentang tanggal, 10.000 baris, serta perlindungan formula spreadsheet.
- Data finansial selalu dibaca fresh. Stok, waste, HPP, margin, gross profit, dan diskon belum termasuk karena milestone inventory ditunda.

## Menjalankan aplikasi

```powershell
npm run dev
```

Route utama:

- `/sign-in` — login email dan kata sandi.
- `/workspace` — workspace semua role yang sah.
- `/pos` — register kasir untuk outlet aktif.
- `/kitchen` — antrean kitchen ticket outlet aktif.
- `/shifts` — shift pribadi, shift terbuka, dan riwayat outlet aktif.
- `/shifts/[shiftId]` — rincian rekonsiliasi, pembayaran, movement, transaksi, dan audit shift.
- `/attendance` — pendaftaran wajah serta absensi masuk/pulang milik akun aktif.
- `/attendance/manage` — review pengecualian, koreksi, profil wajah, dan ekspor untuk owner/manager.
- `/attendance/roster` — template shift dan roster mingguan outlet aktif untuk owner/manager.
- `/transactions` — riwayat struk outlet aktif.
- `/transactions/[saleId]` — rincian snapshot transaksi yang sudah dibayar.
- `/settlements` — konfigurasi harga ojol, piutang platform, dan rekonsiliasi batch untuk owner/manager.
- `/reports` — laporan penjualan, produk, pembayaran, shift, koreksi, settlement, dan ekspor CSV untuk owner/manager.
- `/catalog` — katalog master untuk owner dan menu outlet efektif untuk manager/kasir.
- `/catalog/products/[productId]` — editor varian dan pemasangan modifier khusus owner.
- `/catalog/modifiers` — pustaka modifier reusable khusus owner.
- `/outlets` — directory outlet; owner mengelola, role lain melihat cakupan masing-masing.
- `/staff` — roster staf; owner mengelola manager/kasir, manager mengelola kasir pada outlet tugasnya.
- `/settings` — pengaturan operasional outlet aktif untuk owner/manager.
- `/settings/attendance` — editor peta, koordinat, radius, dan status absensi outlet aktif.
- `/settings/staff-positions` — konfigurasi jabatan kerja global khusus owner.
- `/select-outlet` — memilih konteks outlet aktif untuk session.
- `/change-password` — penggantian wajib untuk password sementara.
- `/design-system` — referensi UI khusus owner.

## Outlet dan staf

Migration `add_outlets_staff` menambahkan outlet, penugasan user-outlet, outlet aktif pada session, kewajiban ganti password, dan audit administratif. Migration `add_staff_roles_and_rosters` memisahkan role akses dari jabatan kerja. Aturan utamanya:

- Hanya owner yang dapat membuat, mengubah, mengarsipkan, atau memulihkan outlet.
- Manager dan staf biasa dapat ditugaskan ke beberapa outlet; kasir wajib tepat satu outlet.
- Manager hanya dapat mengelola kasir/staf biasa di outlet yang juga ditugaskan kepadanya. Hanya owner yang dapat membuat, mengubah, mengarsipkan, atau memulihkan jabatan.
- Role `staff` hanya memperoleh workspace, daftar outlet, absensi pribadi, dan profil. Nama jabatan tidak menambah permission aplikasi.
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

Runner admin membuat dua outlet dan tiga akun sementara, menjalankan journey CRUD/authorization termasuk akses laporan manager/kasir, menyimpan screenshot ke `.artifacts/admin`, lalu membersihkan seluruh fixture.

Untuk menguji alur live buka shift, checkout tunai/QRIS, movement, blind close, rekonsiliasi, serta viewport tablet/mobile:

```powershell
$env:E2E_ALLOW_TEST_USERS="true"
npm run test:e2e:shift-live
```

Runner shift memakai server Next.js dan folder build terisolasi, membuat fixture sementara pada database development/test, memverifikasi laporan/CSV serta screenshot report responsif di `.artifacts/shifts`, lalu membersihkan seluruh data finansial dan akun fixture. Jangan jalankan flag ini pada database production.

Untuk menguji save/send, delta catatan, pembatalan, konflik dua sesi, meja unik, status dapur, dan pembayaran lintas shift:

```powershell
$env:E2E_ALLOW_TEST_USERS="true"
npm run test:e2e:order-live
```

Runner order membuat outlet, produk, owner, kasir, shift, order, ticket, dan transaksi dengan ID unik, lalu membersihkan hanya fixture run tersebut di blok `finally`. Flag persetujuan wajib diberikan setiap kali karena runner menulis data sementara ke database yang sedang dikonfigurasi.

## Script database dan auth

- `npm run db:generate` menghasilkan Prisma client ke `generated/prisma`.
- `npm run db:migrate` membuat dan menjalankan migration versioned memakai `DATABASE_URL_UNPOOLED` development.
- `npm run db:migrate:deploy` menerapkan migration yang sudah dibuat ke production secara manual.
- `npm run db:studio` membuka Prisma Studio.
- `npm run auth:generate -- -y` menyelaraskan model Better Auth ke schema Prisma.
- `npm run seed:owner` membuat owner bootstrap secara aman.
- `npm run seed:drinks -- --development` menambahkan kategori Minuman dan sembilan produk umum rumah makan sate tanpa mengubah data existing.

Dokumentasi rujukan: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Prisma PostgreSQL](https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql), [Better Auth Prisma adapter](https://www.better-auth.com/docs/adapters/prisma), dan [Vercel Blob server uploads](https://vercel.com/docs/vercel-blob/server-upload).

Daftar tujuan, input, output, dan side effect function baru tersedia di [`docs/functions.md`](docs/functions.md).
