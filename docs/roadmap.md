# Glutong POS Roadmap

Dokumen ini adalah sumber utama rencana pengembangan Glutong POS. Perbarui status dan keputusan di sini sebelum memulai milestone baru. Fitur yang sudah selesai tetap didokumentasikan secara operasional di [`README.md`](../README.md), sedangkan aturan implementasi yang berlaku permanen tetap berada di [`AGENTS.md`](../AGENTS.md).

Terakhir diperbarui: 11 Agustus 2026

## Status

- `Planned`: disetujui sebagai rencana, tetapi belum dikerjakan.
- `In Progress`: sedang dikerjakan pada milestone aktif.
- `Deferred`: disetujui tetapi sengaja ditunda karena belum sesuai kebutuhan operasional saat ini.
- `Blocked`: tidak dapat dilanjutkan sebelum keputusan atau akses eksternal tersedia.
- `Completed`: sudah diimplementasikan dan diverifikasi.

Hanya satu milestone utama yang sebaiknya berstatus `In Progress` agar perubahan database, aturan bisnis, dan antarmuka tetap mudah ditinjau.

## Prinsip produk

- Utamakan alur operasional kafe/restoran yang cepat dipelajari oleh kasir.
- Semua layar harus responsif untuk mobile, tablet, dan desktop.
- Data session, permission, stok, transaksi, pembayaran, dan settlement harus dibaca fresh.
- Nilai uang harus menggunakan `Decimal`; transaksi finansial penting harus atomik dan memiliki audit trail.
- Transaksi finansial tidak dihapus permanen. Koreksi dilakukan melalui void, cancellation, refund, reversal, atau stock movement yang dapat dilacak.
- Integrasi eksternal dimulai dari jalur paling sederhana yang dapat diverifikasi, kemudian ditingkatkan ke API/webhook ketika akses resmi tersedia.
- Secret, token, credential, dan contoh payload berisi data pelanggan tidak boleh disimpan di dokumen atau repository.

## Baseline yang sudah tersedia

| Area | Status | Ringkasan |
| --- | --- | --- |
| Authentication dan RBAC | Completed | Better Auth, owner/manager/cashier/staff, password sementara, dan pencabutan session |
| Outlet dan staf | Completed | Multi-outlet, jabatan kerja terpisah dari role, penugasan staf, outlet aktif, wilayah, dan audit administratif |
| Katalog | Completed | Kategori, produk, varian, modifier, gambar, harga dan ketersediaan outlet |
| Register POS | Completed | Dine-in, takeaway, delivery, perhitungan pajak/layanan, dan pembayaran satu metode |
| Transaksi dan struk | Completed | Nomor struk outlet, snapshot item, riwayat, rincian transaksi, dan audit create |
| Ojol dan settlement | Completed | Harga channel, piutang platform, settlement batch, dan reversal settlement |
| Laporan operasional | Completed | Penjualan, produk, pembayaran, shift, koreksi, settlement, filter outlet/tanggal, dan CSV |

## Urutan milestone

| Urutan | Milestone | Status | Dependensi utama | Hasil bisnis |
| ---: | --- | --- | --- | --- |
| 1 | Shift kasir dan tutup kas | Completed | Register POS | Uang fisik dapat dicocokkan dengan transaksi per kasir dan outlet |
| 2 | Void dan refund | Completed | Shift kasir | Kesalahan transaksi dapat dikoreksi tanpa menghapus riwayat finansial |
| 3 | Open order dan kitchen ticket | Completed | Transaksi POS | Pesanan dapat diproses sebelum pembayaran dan diteruskan ke dapur |
| 4 | Stok, resep, waste, dan HPP | Deferred | Proses stok usaha perlu dibakukan | Ditunda agar aplikasi tidak memaksakan inventory restoran yang terlalu rinci untuk usaha sate |
| 5 | Laporan operasional dan keuangan | Completed | Shift, refund, transaksi, settlement | Owner dan manager dapat membaca penjualan, kas, koreksi, serta performa outlet |
| 6 | Diskon, promo, split payment, dan pelanggan | Planned | Refund dan laporan dasar | Metode pembayaran serta retensi pelanggan menjadi lebih fleksibel |
| 7 | Printer struk dan Kitchen Display System | Deferred | Open order | Browser printing pelanggan selesai; perangkat dapur dan integrasi printer menunggu pembelian serta pengujian perangkat |
| 8 | Integrasi platform eksternal | Planned | Order, settlement, dan laporan stabil | Input manual dapat dikurangi melalui impor atau koneksi resmi |
| 9 | Absensi karyawan berbasis wajah dan lokasi | Deferred | Authentication, staf, outlet, RBAC, dan audit | Implementasi web selesai; aktivasi operasional menunggu migration deployment dan pilot perangkat Android nyata |
| 10 | Role staf, jabatan, dan roster absensi | In Progress | Absensi, outlet, staf, RBAC, dan audit | Jadwal kerja per outlet dapat diterbitkan, dicocokkan saat absensi, dan dilaporkan tanpa membuka akses POS |

## Milestone 1 — Shift kasir dan tutup kas

### Tujuan

Mengelompokkan transaksi dan pergerakan uang berdasarkan shift aktif sehingga saldo kas seharusnya dapat dibandingkan dengan uang fisik saat penutupan.

### Cakupan MVP

- Kasir membuka shift pada outlet aktif dengan saldo awal kas.
- Satu kasir hanya memiliki satu shift terbuka pada satu waktu.
- Setiap penjualan terhubung ke shift yang aktif saat checkout.
- Kas masuk dan kas keluar non-penjualan membutuhkan nominal, kategori, dan alasan.
- Penutupan menghitung saldo seharusnya dari saldo awal, penjualan tunai, kas masuk, kas keluar, dan refund tunai dari shift pelaksana.
- Kasir memasukkan jumlah uang fisik aktual; sistem menyimpan selisih tanpa mengubah hasil hitung.
- Owner dan manager dapat melihat riwayat serta rincian shift dalam cakupan outletnya.
- Pembukaan, pergerakan kas, dan penutupan dicatat dalam audit trail.

### Belum termasuk

- Absensi dipindahkan ke Milestone 9; payroll, jadwal kerja, dan perhitungan lembur tetap belum direncanakan.
- Integrasi cash drawer atau mesin penghitung uang.
- Persetujuan selisih berdasarkan nominal otomatis sebelum kebutuhan bisnis ditentukan.
- Tidak ada lagi; refund tunai dan non-tunai sudah dikerjakan pada milestone berikutnya.

### Kriteria selesai

- Tidak ada checkout baru yang dapat tersimpan tanpa shift aktif setelah kewajiban shift diaktifkan.
- Dua permintaan pembukaan atau penutupan bersamaan tidak menghasilkan shift ganda.
- Perhitungan kas menggunakan `Decimal` dan diuji untuk penjualan serta kas masuk/keluar.
- Kasir tidak dapat melihat shift outlet lain; manager hanya dapat melihat outlet penugasannya.
- Tampilan buka, operasional, dan tutup shift dapat digunakan di mobile, tablet, dan desktop.

### Keputusan implementasi

- Semua metode pembayaran diringkas; hanya tunai yang memengaruhi expected cash drawer.
- Owner/manager boleh menutup paksa dengan kas aktual dan alasan wajib.
- Shift tetap terbuka melewati tengah malam; tanggal bisnis mengikuti zona waktu outlet saat shift dibuka.
- Satu user hanya boleh memiliki satu shift terbuka secara global.
- Pergantian outlet dan perubahan administratif yang memutus cakupan shift diblokir sampai shift ditutup.
- Input Rupiah operasional memakai pemisah ribuan titik sambil mengirim digit mentah ke server.

## Milestone 2 — Void dan refund

### Cakupan MVP

- Tambahkan status transaksi tanpa mengubah snapshot transaksi asli.
- Void adalah pembalikan penuh pada tanggal bisnis yang sama; transaksi lebih lama menggunakan refund.
- Cancellation sebelum pembayaran ditunda ke milestone open order karena belum ada order belum lunas yang dapat dibatalkan.
- Wajibkan alasan, actor, waktu, nominal, metode pengembalian, dan referensi transaksi asal.
- Refund parsial berbasis item/kuantitas dapat diulang tanpa melebihi sisa yang belum direfund.
- Refund tunai membutuhkan shift aktif milik pelaksana dan mengurangi expected cash shift tersebut tanpa membuka shift asal.
- Refund non-tunai memakai metode asal, dicatat selesai manual, dan wajib menyimpan referensi bank/provider.
- Delivery pending mengurangi piutang settlement; delivery settled diblokir sampai batch dibalik.
- Owner/manager memiliki permission koreksi; kasir tidak dapat melakukan void/refund.

### Kriteria selesai

- Tidak ada hard delete pada sale, payment, sale item, atau refund.
- Operasi koreksi dan audit tersimpan dalam satu transaction database.
- Riwayat serta struk menampilkan status dan hubungan dengan transaksi/refund asal.
- Pengujian mencakup refund berlebih, request ganda, permission, dan transaksi settled.

### Keputusan implementasi

- Sale, payment, item, dan harga asli tetap immutable; koreksi disimpan pada ledger `SaleRefund`/`SaleRefundItem`.
- Semua nominal memakai `Decimal` dan residue pembulatan diberikan pada refund terakhir agar total tidak terlampaui.
- Idempotency token, status sale, ledger refund, dan audit ditulis dalam transaction serializable yang sama.
- Pengembalian stok belum dilakukan karena stock movement baru tersedia pada milestone stok.

## Milestone 3 — Open order dan kitchen ticket

### Cakupan MVP

- Simpan pesanan `OPEN` sebelum pembayaran untuk dine-in dan takeaway.
- Nomor meja wajib unik di antara pesanan dine-in aktif pada outlet yang sama, jika aturan meja tetap dipilih.
- Kasir dapat menambah item, mengubah catatan, mengirim ticket dapur, dan melanjutkan ke pembayaran.
- Kitchen ticket memiliki nomor berurutan, waktu kirim, item, modifier, catatan, dan status cetak/kirim.
- Perubahan setelah ticket dikirim menghasilkan delta ticket agar dapur mengetahui item tambah/batal.
- Checkout menggunakan snapshot order terbaru dan tetap memvalidasi harga serta availability di server.

### Belum termasuk

- Reservasi meja, pemesanan pelanggan mandiri, dan sinkronisasi antar-cabang.
- Kitchen Display System penuh; milestone ini menyiapkan model order dan event dapurnya terlebih dahulu.

### Kriteria selesai

- Open order dine-in/takeaway dapat disimpan, dilanjutkan staf outlet lain, dibatalkan beralasan, dan dibayar pada shift berikutnya.
- Meja aktif unik, optimistic concurrency, idempotency, audit, serta validasi harga/availability ditegakkan di server.
- Catatan item dapat diedit atau dikosongkan; perubahan setelah pengiriman menghasilkan delta ticket dapur.
- Kitchen ticket initial/delta dapat diproses berurutan dari Baru, Diproses, hingga Selesai.
- Unit, component, production build, dan live E2E multi-session lulus pada viewport mobile, tablet, serta desktop tanpa overflow horizontal.

## Milestone 4 — Stok, resep, waste, dan HPP

Status: `Deferred`. Operasional usaha sate saat ini belum membutuhkan pencatatan bahan mentah, resep per gram, produksi batch, supplier, transfer, atau valuasi inventory secara rinci. Scope berikut dipertahankan sebagai referensi dan baru dibuka kembali setelah proses stok nyata sudah baku.

### Cakupan MVP

- Master bahan, satuan dasar, konversi satuan, supplier, dan stok per outlet.
- Stock movement append-only untuk penerimaan, pemakaian, koreksi, waste, transfer, dan reversal.
- Resep produk/varian mengurangi bahan ketika aturan pemicu penjualan disepakati.
- Refund, void, dan pembatalan hanya mengembalikan stok jika kondisi barang memang memungkinkan.
- Peringatan stok minimum serta histori movement yang dapat difilter.
- HPP disimpan sebagai snapshot transaksi agar laporan lama tidak berubah saat harga bahan berubah.

### Arah jika dibuka kembali

- Mulai dari stok sederhana yang benar-benar mudah dihitung, seperti porsi/tusuk siap jual, minuman, dan kemasan.
- Stock opname tetap memakai blind count dan koreksi append-only.
- HPP bahan mentah, resep produksi, transfer, serta metode valuasi diputuskan setelah cara kerja outlet sudah stabil.

## Milestone 5 — Laporan operasional dan keuangan

### Cakupan MVP

- Penjualan per hari, outlet, sumber order, metode pembayaran, kategori, dan produk.
- Ringkasan subtotal, pajak, service charge, refund, void, serta net sales.
- Laporan shift: expected cash, actual cash, selisih, kas masuk, dan kas keluar.
- Laporan settlement: gross, fee, promo merchant, net received, overdue, dan selisih harga direct.
- Filter tanggal menggunakan zona waktu outlet dan ekspor CSV yang dibatasi permission.

### Belum termasuk

- Stok, waste, HPP, gross profit, dan margin karena milestone inventory berstatus `Deferred`.
- Diskon karena aturan diskon baru direncanakan pada milestone fleksibilitas pembayaran.

### Keputusan implementasi

- Owner melihat satu atau seluruh outlet; manager hanya outlet penugasannya; kasir tidak memperoleh akses laporan.
- Penjualan mengikuti business date, sedangkan refund/void mengurangi laporan pada tanggal koreksi dijalankan agar cocok dengan shift dan arus pembayaran.
- Query dibaca fresh, rentang maksimum 366 hari, detail layar dibatasi, dan CSV maksimum 10.000 baris.
- Item penjualan baru menyimpan snapshot kategori; item lama tanpa snapshot ditampilkan sebagai “Kategori belum tersimpan”.

### Kriteria selesai

- Angka laporan dapat ditelusuri kembali ke transaksi, shift, koreksi, atau settlement sumbernya.
- Query selalu dibatasi rentang waktu/pagination dan diuji pada data multi-outlet.
- Total laporan cocok dengan agregasi transaksi pada skenario refund, settlement reversal, dan shift lintas hari.
- Filter, loading, kartu/tabel, dan CSV dapat digunakan pada mobile, tablet, serta desktop tanpa overflow horizontal.

## Milestone 6 — Fleksibilitas pembayaran dan pelanggan

- Diskon item/order dengan alasan, batas permission, snapshot, dan audit.
- Promo terjadwal hanya jika kebutuhan aturan promo sudah jelas.
- Split payment dengan validasi tidak kurang dan tidak lebih dari total tagihan.
- Profil pelanggan minimal: nama, kontak opsional, histori, dan consent.
- Loyalty/member hanya ditambahkan setelah aturan perolehan dan penukaran poin disepakati.

## Milestone 7 — Perangkat operasional

- Browser print struk pelanggan tersedia dari checkout dan halaman `/settings/printers`.
- Layout 58 mm (area isi 52 mm) dan 80 mm (area isi 72 mm), footer per outlet, preview, serta cetak contoh sudah tersedia.
- Cetak otomatis bersifat opt-in per outlet dan browser melalui local storage; preview serta tombol manual selalu dipertahankan.
- Adapter ESC/POS hanya setelah target printer, koneksi USB/LAN/Bluetooth, dan lingkungan deployment diketahui.
- Kitchen Display System menggunakan event order/delta ticket dari milestone open order.
- Mode offline tidak dimulai sebelum kebutuhan toleransi konflik dan pemulihan koneksi ditentukan.

### Status 7A — selesai sebagian

- Konfigurasi outlet, permission `settings.manage`, active-outlet scope, transaction, dan audit before/after sudah diterapkan.
- Browser tetap menentukan printer fisik, jumlah salinan, dan orientasi.
- Milestone berstatus `Deferred` karena printer dapur, KDS perangkat penuh, ESC/POS, USB/LAN/Bluetooth, dan print bridge menunggu pembelian serta pengujian perangkat nyata.

### Rencana 7B — printer langsung dari web

- Target awal adalah Android tablet dengan printer Bluetooth EPPOS RPP02 kertas 58 mm.
- Tambahkan pemilihan/koneksi printer, status koneksi, dan cetak uji langsung pada `/settings/printers` jika kemampuan browser dan profil Bluetooth perangkat mendukungnya.
- Validasi lebih dahulu apakah RPP02 memakai Bluetooth Classic/SPP atau BLE serta apakah browser Android dapat mengirim perintah ESC/POS tanpa aplikasi pendamping.
- Jika akses langsung browser tidak kompatibel, gunakan aplikasi pendamping atau print bridge lokal; dialog cetak browser dari 7A tetap tersedia sebagai fallback.
- Nama printer, jumlah salinan, dan orientasi baru disimpan di web setelah jalur koneksi yang dipakai sudah terbukti pada perangkat nyata.

## Rencana integrasi eksternal

Integrasi harus dikembangkan bertahap. Jangan menjanjikan API langsung sebelum akses partner, dokumentasi resmi, sandbox, dan izin penggunaan data tersedia.

| Integrasi | Tahap pertama | Tahap lanjutan | Status | Prasyarat |
| --- | --- | --- | --- | --- |
| GoFood | Impor CSV settlement/order jika format tersedia | API/webhook resmi | Planned | Akses merchant/partner dan contoh data tersanitasi |
| GrabFood | Impor CSV settlement/order jika format tersedia | API/webhook resmi | Planned | Akses merchant/partner dan dokumentasi resmi |
| ShopeeFood | Impor CSV settlement/order jika format tersedia | API/webhook resmi | Planned | Akses merchant/partner dan dokumentasi resmi |
| Payment gateway/QRIS | Pencatatan referensi manual | Create payment, callback, reconciliation | Planned | Provider dipilih dan webhook sandbox tersedia |
| Printer struk | Browser print | ESC/POS lokal atau print bridge | Deferred | Browser print selesai; EPPOS RPP02 dan topologi Bluetooth belum diuji pada Android tablet |
| Akuntansi | Ekspor CSV terstruktur | API jurnal otomatis | Planned | Target software dan mapping chart of accounts |

### Aturan wajib integrasi

- Credential hanya berada di environment variable dan modul server-only.
- Webhook harus memverifikasi signature, timestamp, sumber, serta batas ukuran payload.
- Setiap event eksternal memiliki idempotency key unik dan aman untuk retry.
- Payload mentah yang perlu disimpan harus disaring dari secret serta memiliki retention policy.
- Status sinkronisasi minimal membedakan `PENDING`, `PROCESSING`, `SUCCEEDED`, dan `FAILED`.
- Kegagalan provider tidak boleh membatalkan transaction bisnis yang sudah commit; gunakan retry/outbox bila diperlukan.
- Mapping produk, outlet, pajak, fee, promo, refund, dan settlement harus terdokumentasi sebelum data production diproses.
- Import menyediakan dry run, validasi baris, laporan error, serta pencegahan duplikasi.

### Checklist sebelum integrasi dimulai

- [ ] Provider dan tujuan bisnis dipilih.
- [ ] Dokumentasi resmi serta hak akses tersedia.
- [ ] Sandbox atau contoh payload tersanitasi tersedia.
- [ ] Arah data dan sumber kebenaran ditentukan.
- [ ] Mapping ID outlet, produk, order, payment, refund, dan settlement disetujui.
- [ ] Strategi idempotency, retry, rate limit, dan observability ditentukan.
- [ ] Retention, privasi, serta permission data disetujui.
- [ ] Acceptance test dan prosedur rollback tersedia.

## Milestone 9 — Absensi karyawan berbasis wajah dan lokasi

Status: `Deferred`. Implementasi web, schema, migration, RBAC, verifikasi `1:1`, geofence, pengecualian, koreksi, laporan, retensi, UI responsif, test, dan production build sudah tersedia. Aktivasi operasional sengaja ditunda sampai migration diterapkan pada environment tujuan serta pilot kamera/GPS pada Android tablet dan ponsel mengalibrasi threshold nyata. Pengembangan software aktif dilanjutkan pada Milestone 10.

### Status implementasi

- `/attendance`, `/attendance/manage`, dan `/settings/attendance` sudah tersedia sebagai halaman dynamic dengan skeleton responsif.
- Enrollment tiga sampel, persetujuan daftar ulang kasir/staf, template AES-256-GCM, nonce sekali pakai, similarity `0,60`, liveness ringan, geofence, idempotency, dan sesi masuk/pulang dijalankan di server sesuai scope akun/outlet.
- Peta OSM menyinkronkan marker pusat, handle radius 44 px, lokasi perangkat, serta input koordinat/radius manual.
- Foto JPEG maksimal 300 KB disimpan privat selama 30 hari dan dihapus melalui Vercel Cron; akses bukti selalu melalui Route Handler terotorisasi.
- Pengecualian setelah tiga kegagalan, review daftar ulang kasir/staf oleh owner/manager, larangan self-approval, koreksi append-only, revoke profile, CSV, dan pembersihan profil saat staf dinonaktifkan sudah diterapkan.
- Prisma validate/generate, Next typegen, seluruh test, lint, typecheck, dan production build lulus. Migration production tetap manual.
- Tersisa sebelum `Completed`: konfigurasi secret/store, `prisma migrate deploy`, serta pilot Android nyata untuk izin kamera/GPS, performa WebGL/WASM, kondisi cahaya, false accept/reject, dan threshold.

### Tujuan

Mencatat waktu masuk dan pulang staf dengan bukti wajah, lokasi outlet, waktu server, serta jalur pengecualian yang dapat diaudit.

### Cakupan MVP

- Absensi dapat dibuka dari tablet atau ponsel tanpa membuat aplikasi native terpisah, tetapi setiap staf wajib menggunakan akun Better Auth miliknya sendiri.
- Semua perangkat memakai verifikasi `1:1`: wajah hanya dibandingkan dengan profil wajah akun yang sedang login, bukan dicari dari seluruh staf outlet.
- Jika staf ditugaskan ke beberapa outlet, staf memilih outlet tujuan dari daftar penugasannya sebelum kamera dan validasi lokasi dijalankan.
- Tablet bersama tidak memiliki session khusus; staf wajib login dan logout akun sendiri, sedangkan layar absensi selalu menampilkan nama akun sebelum kamera dibuka untuk mencegah salah akun.
- Pendaftaran wajah pertama dilakukan sendiri melalui session akun aktif dan langsung dapat digunakan. Daftar ulang kasir menyimpan sampel baru sebagai request terenkripsi; profil lama tetap aktif sampai salah satu owner/manager dalam scope menyetujui. Penolakan mempertahankan profil lama dan menghapus payload request.
- Model `@vladmandic/human` dimuat secara lazy hanya pada layar absensi, memakai WebGL dengan WASM sebagai fallback.
- Liveness ringan menggunakan challenge acak seperti berkedip atau menoleh, nonce sekali pakai, dan masa berlaku singkat. Pendekatan browser-only tidak dianggap sebagai perlindungan spoofing tingkat tinggi.
- Setiap percobaan menyimpan akun pelaksana, hasil pengenalan, foto bukti privat, koordinat, akurasi GPS, jarak dari outlet, dan waktu server.
- Outlet memiliki koordinat serta radius geofence yang dapat diatur 50–500 meter dengan default 100 meter; pembacaan GPS dengan akurasi di atas 100 meter ditolak.
- Pengaturan geofence memakai peta interaktif yang menampilkan marker pusat outlet dan lingkaran cakupan sesuai radius tersimpan.
- Owner/manager dapat memakai lokasi perangkat saat ini, menggeser marker pusat, memperbesar/memperkecil lingkaran melalui handle sentuh, atau mengetik radius dalam meter; peta dan input selalu tersinkron dua arah.
- Setelah tiga kegagalan dalam satu sesi 15 menit, staf dapat mengirim permintaan pengecualian dengan alasan untuk disetujui atau ditolak.
- Owner dapat meninjau seluruh outlet; manager hanya staf/outlet dalam cakupannya dan tidak boleh menyetujui permintaannya sendiri.
- Foto bukti dihapus otomatis setelah 30 hari. Template wajah dienkripsi dan dihapus ketika profil dibatalkan atau staf dinonaktifkan.

### Interface dan data yang direncanakan

- Tambahkan konfigurasi `attendanceEnabled`, latitude, longitude, dan radius pada `Outlet` melalui migration versioned.
- Tambahkan profil wajah terenkripsi dan berversi model, request persetujuan daftar ulang, percobaan verifikasi, sesi absensi, serta permintaan pengecualian.
- Batasi satu sesi absensi terbuka per staf secara global; check-out normal harus dilakukan pada outlet check-in yang sama.
- Waktu server menjadi sumber kebenaran dan tanggal bisnis mengikuti zona waktu outlet.
- Tambahkan permission terpusat untuk clock-in/out, melihat absensi sendiri, review pengecualian, pengaturan outlet, serta laporan absensi.
- Rencanakan halaman `/attendance`, `/attendance/manage`, dan `/settings/attendance` dengan state akun aktif, kamera, lokasi, loading, error, izin ditolak, fallback pengecualian, serta editor peta geofence.
- Route Handler melayani challenge dan verifikasi wajah dari session akun aktif; Server Action menangani enrollment, pengaturan, review, dan koreksi internal yang dilindungi session/permission.
- Semua event penting memakai idempotency key, transaction, dan audit trail. Koreksi tidak menimpa catatan asal.

### Keputusan pencocokan dan keamanan

- Embedding probe dibuat di browser, tetapi pencocokan dengan template terenkripsi dan validasi geofence tetap dilakukan di server.
- Threshold awal similarity verifikasi `1:1` adalah `0,60`. Nilai disimpan bersama versi model dan wajib dikalibrasi pada perangkat nyata sebelum rilis.
- Server selalu mengambil template dari user ID session terverifikasi dan menolak probe wajah yang tidak cocok dengan akun tersebut.
- Editor peta dimuat dinamis sebagai Client Component kecil. Tombol “Gunakan lokasi saya” meminta geolocation hanya saat ditekan; perubahan marker, handle radius, dan input angka belum mengubah database sampai form disimpan.
- Marker dan lingkaran otomatis difokuskan agar seluruh radius terlihat. Input radius memakai satuan meter, dibatasi 50–500, dan menyediakan alternatif keyboard ketika drag peta tidak dapat digunakan.
- Foto bukti berada di object storage privat dengan akses terotorisasi; tidak memakai URL publik katalog.
- Enrollment menampilkan persetujuan penggunaan data wajah dan kebijakan retensi sebelum kamera dibuka. Hanya satu request daftar ulang kasir boleh pending; payload terenkripsi dihapus setelah approval/rejection dan tidak dikirim ke UI pengelola.
- Absensi membutuhkan koneksi internet karena challenge, waktu, pencocokan, geofence, dan idempotency harus diverifikasi server.

### Belum termasuk

- Jadwal/roster kerja serta status terlambat/pulang cepat dipindahkan ke Milestone 10. Istirahat, lembur, cuti, payroll, dan perhitungan gaji tetap belum termasuk.
- Mode offline, aplikasi Android native, device attestation, dan jaminan anti-spoof setara layanan liveness khusus.
- Pelacakan lokasi terus-menerus; koordinat hanya diminta ketika enrollment atau absensi dijalankan.

### Kriteria selesai

- Check-in/check-out valid menghasilkan satu sesi yang konsisten meskipun request dikirim ulang atau bersamaan.
- Wajah yang tidak sesuai dengan akun, foto statis, nonce replay/kedaluwarsa, lokasi di luar radius, serta GPS tidak akurat ditolak dan tercatat aman.
- Peta menginisialisasi koordinat tersimpan atau lokasi perangkat, menyinkronkan drag/input radius tanpa loop, membatasi nilai 50–500 meter, dan tetap dapat dioperasikan dengan sentuhan maupun keyboard.
- Izin lokasi ditolak, lokasi tidak akurat, peta gagal dimuat, dan outlet belum memiliki koordinat menampilkan petunjuk pemulihan tanpa menghilangkan input manual.
- Kegagalan ketiga membuka pengecualian; approval memakai waktu percobaan asli, menyimpan reviewer/alasan, dan menolak self-approval.
- Profil wajah, request daftar ulang, approval/rejection, bukti foto, session akun, permission, outlet assignment, penghapusan 30 hari, dan pencabutan staf diuji.
- Pilot pada Android tablet dan Android phone membuktikan login akun sendiri, verifikasi `1:1`, serta model/fallback dapat digunakan tanpa menghambat navigasi aplikasi lain.
- Loading, camera/location permission, empty, success, failure, dan review state dapat digunakan pada mobile, tablet, serta desktop tanpa overflow horizontal.
- README dan dokumentasi fungsi baru diperbarui hanya setelah implementasi selesai dan milestone siap ditandai `Completed`.

## Milestone 10 — Role staf, jabatan, dan roster absensi

Status: `In Progress`. Implementasi dan migration tersedia; status baru menjadi `Completed` setelah seluruh quality check lulus dan migration diterapkan pada environment tujuan. Pilot kamera/GPS tetap mengikuti status operasional Milestone 9.

### Tujuan

Memisahkan jabatan pekerjaan dari hak akses aplikasi serta menghubungkan jadwal kerja outlet ke check-in/check-out tanpa menambah scope payroll.

### Cakupan MVP

- Role `staff` hanya dapat membuka workspace, outlet yang ditugaskan, absensi pribadi, dan profil; POS, shift kasir, katalog, laporan, pengelolaan staf, pengaturan, roster, dan review ditolak secara default.
- Jabatan kerja dikelola global oleh owner dan tidak memberi permission. Manager dapat mengelola akun kasir/staf biasa dalam cakupan outletnya, sedangkan privilege escalation ke manager tetap ditolak.
- Kasir tetap ditugaskan tepat ke satu outlet. Manager dan staf biasa dapat ditugaskan ke beberapa outlet.
- Template shift dimiliki outlet, menyimpan jam mulai/selesai, dan mendukung shift lintas tengah malam.
- Roster memakai minggu Senin–Minggu, satu shift per staf per tanggal secara global, draf atomik, salin minggu lalu, publish, optimistic concurrency, snapshot zona waktu/jabatan/toleransi, dan audit.
- Roster terbit tidak kembali menjadi draf. Shift masa depan dapat diganti dengan alasan wajib; jadwal yang sudah mulai atau berlalu dikunci.
- Staf melihat roster terbit minggu berjalan dan minggu berikutnya. Check-in terjadwal dibuka dua jam sebelum shift; check-in lain membutuhkan konfirmasi **Di luar jadwal** dan tetap tercatat untuk ditinjau.
- Toleransi terlambat dan pulang cepat diatur per outlet 0–120 menit dengan default 15 menit. Ringkasan manager dan CSV menampilkan jabatan, jadwal, status, menit terlambat/pulang cepat, serta total jam.

### Interface dan data

- Migration `add_staff_roles_and_rosters` menambahkan `StaffPosition`, `AttendanceShiftTemplate`, `AttendanceRosterWeek`, `AttendanceRosterEntry`, schedule match pada verification/session, jabatan pada user, serta toleransi outlet.
- `/settings/staff-positions` hanya untuk owner. `/attendance/roster` hanya untuk owner/manager pada outlet aktif. `/attendance` tetap menjadi halaman semua role untuk absensi akun sendiri.
- Constraint database `userId + workDate` mencegah satu staf dijadwalkan di dua outlet pada tanggal yang sama; semua mutation roster berjalan dalam transaction dan menulis audit before/after yang relevan.
- Layout papan desktop berubah menjadi kartu per hari pada tablet/mobile dan loading skeleton mengikuti bentuk masing-masing viewport tanpa overflow horizontal.

### Belum termasuk

- Istirahat, split shift, lembur, cuti/izin, tukar shift mandiri, payroll, perhitungan gaji, dan notifikasi jadwal.
- Roster berulang tanpa tanggal, kebutuhan tenaga per posisi, auto-scheduling, serta integrasi kalender eksternal.

### Kriteria selesai

- Permission role staff, aturan penugasan outlet, scope manager, jabatan owner-only, dan pencegahan privilege escalation memiliki test.
- Shift lintas tengah malam, jendela dua jam, batas toleransi, status absensi, duplikasi global, publish, revisi masa depan, dan lock jadwal lalu memiliki test.
- Prisma format/validate/generate, Next typegen, seluruh test, lint, typecheck, production build, dan pemeriksaan migration lulus.
- Halaman jabatan, roster, absensi pribadi, dan ringkasan manager dapat digunakan pada mobile, tablet, dan desktop.

## Definition of Done setiap milestone

- Scope, non-goal, permission, dan keputusan bisnis telah disepakati.
- Schema berubah melalui migration versioned; Prisma Client digenerate ulang.
- Server Action/Route Handler memvalidasi input, session, permission, dan outlet di server.
- Business rule finansial/stok memakai transaction dan audit trail sesuai kebutuhan.
- Unit/integration test melindungi aturan bisnis, permission, idempotency, dan kondisi race yang penting.
- UI memiliki loading, empty, error, pending, dan success state yang aksesibel.
- UI diverifikasi pada mobile, tablet, dan desktop.
- `README.md` dan `docs/functions.md` diperbarui setelah implementasi selesai.
- Lint, typecheck, test relevan, dan production build dijalankan sebelum status menjadi `Completed`.

## Decision log

| Tanggal | Keputusan | Alasan |
| --- | --- | --- |
| 8 Agustus 2026 | Shift kasir menjadi milestone berikutnya | Penjualan sudah tersedia, tetapi uang fisik belum dapat direkonsiliasi per shift |
| 8 Agustus 2026 | Void/refund dikerjakan sebelum stok | Reversal finansial perlu stabil sebelum menentukan pengembalian movement stok |
| 8 Agustus 2026 | Integrasi platform dimulai dari impor terverifikasi | API partner belum boleh diasumsikan tersedia dan jalur manual lebih mudah diaudit |
| 8 Agustus 2026 | Roadmap tidak disimpan di `AGENTS.md` | Roadmap berubah mengikuti prioritas produk, sedangkan `AGENTS.md` berisi aturan implementasi permanen |
| 8 Agustus 2026 | Shift kasir selesai dan tervalidasi live | E2E membuktikan checkout tunai/QRIS, movement, blind close, rekonsiliasi, dan viewport tablet/mobile |
| 9 Agustus 2026 | Cancellation dipindahkan ke milestone open order | Sistem saat ini langsung membuat transaksi lunas sehingga belum ada order sebelum pembayaran yang dapat dibatalkan |
| 9 Agustus 2026 | Koreksi dibatasi untuk owner/manager | Refund memengaruhi kas dan piutang sehingga kasir hanya dapat melihat hasil koreksi |
| 9 Agustus 2026 | Void/refund selesai dan tervalidasi lokal | Schema, permission, transaksi serializable, cash drawer, settlement bersih, UI, unit/component test, dan production build sudah lulus |
| 9 Agustus 2026 | Open order memakai model Order terpadu | Checkout langsung dan pembayaran akhir berbagi snapshot, audit, dan jalur kitchen ticket yang sama |
| 9 Agustus 2026 | Simpan order dikonfigurasi per outlet oleh owner/manager | Kasir tetap fokus pada operasi; perubahan konfigurasi tercatat dan dibatasi outlet aktif |
| 9 Agustus 2026 | Kitchen ticket delivery dibuat otomatis | Semua sumber pesanan berbayar masuk antrean dapur yang sama tanpa jalur khusus platform |
| 9 Agustus 2026 | Migration production dijalankan manual | Vercel build tidak boleh mengubah schema dan development wajib memakai branch Neon terpisah |
| 9 Agustus 2026 | Milestone inventory ditunda | Proses usaha sate belum memerlukan resep bahan mentah dan valuasi stok sedetail sistem restoran besar |
| 9 Agustus 2026 | Laporan berjalan tanpa dependensi stok | Data transaksi, shift, refund, dan settlement sudah cukup stabil; HPP serta margin dikeluarkan dari scope |
| 9 Agustus 2026 | Refund dilaporkan pada tanggal pelaksanaan | Angka harian harus dapat direkonsiliasi dengan shift dan arus pembayaran yang benar-benar terjadi |
| 9 Agustus 2026 | Laporan operasional selesai dan tervalidasi live | Enam view, CSV, snapshot kategori, permission owner/manager, query database, responsive UI, unit test, E2E, dan production build lulus |
| 9 Agustus 2026 | Open order dan kitchen ticket selesai serta tervalidasi live | E2E membuktikan save/send, delta catatan, pembatalan, meja unik, konflik dua sesi, status dapur, lintas shift, dan layout responsif |
| 9 Agustus 2026 | Browser printing dipilih sebagai fondasi printer struk | Aman diuji tanpa model printer tertentu; ESC/POS menunggu model serta koneksi perangkat, sedangkan KDS menunggu alur dapur nyata |
| 9 Agustus 2026 | Printer langsung dari web direncanakan sebagai Milestone 7B | Target Android tablet dan EPPOS RPP02 58 mm; profil Bluetooth serta dukungan browser harus diuji sebelum memilih Web Bluetooth, aplikasi pendamping, atau print bridge |
| 9 Agustus 2026 | Absensi wajah dan geofence direncanakan sebagai Milestone 9 | Setiap staf memakai akun sendiri dan verifikasi wajah `1:1` pada tablet atau ponsel; geofence default 100 meter, pengecualian setelah tiga kegagalan, serta retensi foto 30 hari |
| 9 Agustus 2026 | Geofence dikonfigurasi melalui peta dan input radius dua arah | Owner/manager dapat melihat cakupan nyata, menggeser pusat, serta mengubah radius lewat drag atau angka tanpa menebak koordinat mentah |
| 9 Agustus 2026 | Milestone 7 ditunda dan Milestone 9 menjadi aktif | Printer Bluetooth menunggu perangkat EPPOS RPP02; absensi web selesai di source tetapi tetap `In Progress` sampai migration deployment dan pilot Android nyata lulus |
| 11 Agustus 2026 | Daftar ulang wajah kasir/staff memerlukan satu persetujuan owner atau manager | Template lama tetap aktif selama review; sampel baru terenkripsi dan dihapus dari request setelah disetujui atau ditolak |
| 11 Agustus 2026 | Role akses `staff` dipisahkan dari jabatan kerja | Pelayan, barista, dan pekerjaan lain perlu absensi serta outlet tanpa otomatis memperoleh akses POS atau pengelolaan |
| 11 Agustus 2026 | Roster memakai satu shift per staf per tanggal secara global | Staf multi-outlet tidak boleh memiliki jadwal bertabrakan; snapshot menjaga histori tetap benar setelah template, jabatan, zona waktu, atau toleransi berubah |

## Cara memperbarui roadmap

1. Ubah satu milestone menjadi `In Progress` sebelum implementasi dimulai.
2. Catat keputusan bisnis baru pada bagian milestone dan decision log.
3. Tandai `Blocked` beserta blocker konkret jika membutuhkan keputusan atau akses eksternal.
4. Setelah semua kriteria selesai dan terverifikasi, ubah status menjadi `Completed`.
5. Pindahkan perilaku fitur yang sudah rilis ke `README.md`; pertahankan ringkasannya di roadmap sebagai histori.
6. Pecah spesifikasi ke `docs/integrations/` hanya ketika satu integrasi mulai dikerjakan dan detailnya tidak lagi nyaman disimpan di dokumen ini.
