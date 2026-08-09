# Glutong POS Roadmap

Dokumen ini adalah sumber utama rencana pengembangan Glutong POS. Perbarui status dan keputusan di sini sebelum memulai milestone baru. Fitur yang sudah selesai tetap didokumentasikan secara operasional di [`README.md`](../README.md), sedangkan aturan implementasi yang berlaku permanen tetap berada di [`AGENTS.md`](../AGENTS.md).

Terakhir diperbarui: 9 Agustus 2026

## Status

- `Planned`: disetujui sebagai rencana, tetapi belum dikerjakan.
- `In Progress`: sedang dikerjakan pada milestone aktif.
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
| Authentication dan RBAC | Completed | Better Auth, owner/manager/cashier, password sementara, dan pencabutan session |
| Outlet dan staf | Completed | Multi-outlet, penugasan staf, outlet aktif, wilayah, dan audit administratif |
| Katalog | Completed | Kategori, produk, varian, modifier, gambar, harga dan ketersediaan outlet |
| Register POS | Completed | Dine-in, takeaway, delivery, perhitungan pajak/layanan, dan pembayaran satu metode |
| Transaksi dan struk | Completed | Nomor struk outlet, snapshot item, riwayat, rincian transaksi, dan audit create |
| Ojol dan settlement | Completed | Harga channel, piutang platform, settlement batch, dan reversal settlement |

## Urutan milestone

| Urutan | Milestone | Status | Dependensi utama | Hasil bisnis |
| ---: | --- | --- | --- | --- |
| 1 | Shift kasir dan tutup kas | Completed | Register POS | Uang fisik dapat dicocokkan dengan transaksi per kasir dan outlet |
| 2 | Void dan refund | Completed | Shift kasir | Kesalahan transaksi dapat dikoreksi tanpa menghapus riwayat finansial |
| 3 | Open order dan kitchen ticket | Completed | Transaksi POS | Pesanan dapat diproses sebelum pembayaran dan diteruskan ke dapur |
| 4 | Stok, resep, waste, dan HPP | Planned | Void/refund dan open order | Persediaan serta biaya produk dapat dihitung dari kejadian operasional nyata |
| 5 | Laporan operasional dan keuangan | Planned | Shift, refund, stok | Owner dapat membaca penjualan, kas, margin, dan performa outlet |
| 6 | Diskon, promo, split payment, dan pelanggan | Planned | Refund dan laporan dasar | Metode pembayaran serta retensi pelanggan menjadi lebih fleksibel |
| 7 | Printer struk dan Kitchen Display System | Planned | Open order | Alur kasir-dapur dapat berjalan pada perangkat operasional |
| 8 | Integrasi platform eksternal | Planned | Order, settlement, dan laporan stabil | Input manual dapat dikurangi melalui impor atau koneksi resmi |

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

- Absensi, payroll, jadwal kerja, dan perhitungan lembur.
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

### Cakupan MVP

- Master bahan, satuan dasar, konversi satuan, supplier, dan stok per outlet.
- Stock movement append-only untuk penerimaan, pemakaian, koreksi, waste, transfer, dan reversal.
- Resep produk/varian mengurangi bahan ketika aturan pemicu penjualan disepakati.
- Refund, void, dan pembatalan hanya mengembalikan stok jika kondisi barang memang memungkinkan.
- Peringatan stok minimum serta histori movement yang dapat difilter.
- HPP disimpan sebagai snapshot transaksi agar laporan lama tidak berubah saat harga bahan berubah.

### Keputusan terbuka

- Apakah stok berkurang saat order dikirim ke dapur atau saat pembayaran selesai?
- Apakah stok negatif selalu dilarang atau owner dapat memberi override beralasan?
- Metode valuasi awal: moving average atau FIFO.

## Milestone 5 — Laporan operasional dan keuangan

### Cakupan MVP

- Penjualan per hari, outlet, sumber order, metode pembayaran, kategori, dan produk.
- Ringkasan pajak, service charge, diskon, refund, void, serta net sales.
- Laporan shift: expected cash, actual cash, selisih, kas masuk, dan kas keluar.
- Laporan settlement: gross, fee, promo merchant, net received, overdue, dan selisih harga direct.
- Laporan stok/HPP: pemakaian, waste, nilai persediaan, gross profit, dan margin.
- Filter tanggal menggunakan zona waktu outlet dan ekspor CSV yang dibatasi permission.

### Kriteria selesai

- Angka laporan dapat ditelusuri kembali ke transaksi atau movement sumbernya.
- Query selalu dibatasi rentang waktu/pagination dan diuji pada data multi-outlet.
- Total laporan cocok dengan agregasi transaksi pada skenario refund, settlement reversal, dan shift lintas hari.

## Milestone 6 — Fleksibilitas pembayaran dan pelanggan

- Diskon item/order dengan alasan, batas permission, snapshot, dan audit.
- Promo terjadwal hanya jika kebutuhan aturan promo sudah jelas.
- Split payment dengan validasi tidak kurang dan tidak lebih dari total tagihan.
- Profil pelanggan minimal: nama, kontak opsional, histori, dan consent.
- Loyalty/member hanya ditambahkan setelah aturan perolehan dan penukaran poin disepakati.

## Milestone 7 — Perangkat operasional

- Browser print sebagai fallback struk awal.
- Layout struk 58 mm/80 mm yang dapat diuji tanpa printer khusus.
- Adapter ESC/POS hanya setelah target printer, koneksi USB/LAN/Bluetooth, dan lingkungan deployment diketahui.
- Kitchen Display System menggunakan event order/delta ticket dari milestone open order.
- Mode offline tidak dimulai sebelum kebutuhan toleransi konflik dan pemulihan koneksi ditentukan.

## Rencana integrasi eksternal

Integrasi harus dikembangkan bertahap. Jangan menjanjikan API langsung sebelum akses partner, dokumentasi resmi, sandbox, dan izin penggunaan data tersedia.

| Integrasi | Tahap pertama | Tahap lanjutan | Status | Prasyarat |
| --- | --- | --- | --- | --- |
| GoFood | Impor CSV settlement/order jika format tersedia | API/webhook resmi | Planned | Akses merchant/partner dan contoh data tersanitasi |
| GrabFood | Impor CSV settlement/order jika format tersedia | API/webhook resmi | Planned | Akses merchant/partner dan dokumentasi resmi |
| ShopeeFood | Impor CSV settlement/order jika format tersedia | API/webhook resmi | Planned | Akses merchant/partner dan dokumentasi resmi |
| Payment gateway/QRIS | Pencatatan referensi manual | Create payment, callback, reconciliation | Planned | Provider dipilih dan webhook sandbox tersedia |
| Printer struk | Browser print | ESC/POS lokal atau print bridge | Planned | Model printer dan topologi perangkat diketahui |
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
| 9 Agustus 2026 | Open order dan kitchen ticket selesai serta tervalidasi live | E2E membuktikan save/send, delta catatan, pembatalan, meja unik, konflik dua sesi, status dapur, lintas shift, dan layout responsif |

## Cara memperbarui roadmap

1. Ubah satu milestone menjadi `In Progress` sebelum implementasi dimulai.
2. Catat keputusan bisnis baru pada bagian milestone dan decision log.
3. Tandai `Blocked` beserta blocker konkret jika membutuhkan keputusan atau akses eksternal.
4. Setelah semua kriteria selesai dan terverifikasi, ubah status menjadi `Completed`.
5. Pindahkan perilaku fitur yang sudah rilis ke `README.md`; pertahankan ringkasannya di roadmap sebagai histori.
6. Pecah spesifikasi ke `docs/integrations/` hanya ketika satu integrasi mulai dikerjakan dan detailnya tidak lagi nyaman disimpan di dokumen ini.
