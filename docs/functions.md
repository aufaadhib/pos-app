# Function Reference

Dokumen ini mencatat function dan component function yang ditambahkan pada milestone fondasi Glutong POS. Nama kode menggunakan bahasa Inggris; penjelasan ditulis dalam Bahasa Indonesia.

## Authentication, authorization, dan database

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `createAuth()` | Opsi `allowSignUp` dan `defaultRole` | Instance Better Auth | Membentuk konfigurasi runtime atau seed. Instance seed dapat mengaktifkan sign-up secara lokal; endpoint runtime tetap menonaktifkannya. |
| `getCurrentSession()` | Tidak ada; membaca header request aktif | Session atau `null` | Membaca session server-side. Dideduplikasi dengan React `cache()` hanya selama satu render/request. |
| `requireSession()` | Tidak ada | Session valid | Mengalihkan pengguna anonim ke `/sign-in`. |
| `requirePermission()` | Satu object permission terpusat | Session valid | Memeriksa permission melalui Better Auth menggunakan user ID terbaru; mengalihkan akses gagal ke workspace. |
| `requirePasswordReadySession()` | Tidak ada | Session valid | Mengalihkan akun dengan password sementara ke `/change-password` sebelum area operasional dapat dibuka. |
| `seedInitialOwner()` | Environment bootstrap | Data user owner | Membuat owner hanya pada database kosong, no-op untuk owner identik, dan abort untuk akun yang bertentangan. Menulis user/account dan password hash melalui Better Auth. |
| `seedDrinkMenu()` | Flag CLI `--development` | Jumlah produk dibuat/dilewati | Menambahkan kategori Minuman dan sembilan produk secara idempotent, menolak production, serta menulis audit memakai owner pertama. |
| `createPrismaClient()` | `DATABASE_URL` dari environment | Prisma client dengan Neon adapter | Membentuk koneksi pooled untuk runtime; instance digunakan ulang saat development. |
| `parseServerEnvironment()` | Object environment | Environment tervalidasi | Memvalidasi URL database, base URL auth, dan secret. Melempar error tanpa membocorkan nilai rahasia. |
| `parseOwnerEnvironment()` | Object environment | Environment owner tervalidasi | Menambahkan validasi nama/email serta password bootstrap minimum 12 karakter. |
| `getServerEnvironment()` | Tidak ada | Environment server tervalidasi | Membaca `process.env` hanya dari modul berpagar `server-only`. |
| `isAppRole()` | String role | Type predicate | Menentukan apakah nilai merupakan `owner`, `manager`, `cashier`, atau `staff`. |
| `roleHasPermission()` | Role dan permission | Boolean | Mengevaluasi matrix RBAC yang sama dengan Better Auth untuk kebutuhan presentasi server. |

## Outlet, wilayah, dan konteks session

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `normalizeOperationalLabel()`, `normalizeOutletName()`, `normalizeOutletCode()` | Teks nama/kode | String ternormalisasi | Menyeragamkan Unicode, spasi, kapitalisasi, dan kunci unik outlet tanpa side effect. |
| `suggestOutletCode()` | Nama outlet | Kode maksimum 12 karakter | Memberi saran kode otomatis yang tetap dapat diedit pengguna. |
| `formatOutletAddress()` | Bagian alamat outlet | String alamat | Menggabungkan alamat jalan, kota, dan provinsi tanpa fragmen kosong. |
| `getOutlets()` | Filter, page, dan actor | DTO halaman outlet | Membaca outlet sesuai cakupan role dengan pagination server-side. |
| `getAccessibleOutlets()` | User ID dan role | Daftar outlet aktif | Membaca pilihan outlet yang sah untuk session pengguna. |
| `getActiveOutlet()` | Outlet session, user, role | Ringkasan outlet atau `null` | Memastikan outlet session masih aktif dan berada dalam cakupan user. |
| `requireActiveOutlet()` | Session terverifikasi | Outlet aktif | Mengalihkan ke pemilih outlet bila konteks session hilang atau tidak lagi sah. |
| `createOutlet()`, `updateOutlet()` | Data outlet dan actor | Outlet terbaru | Menulis outlet serta audit dalam satu transaction dan menolak duplikasi/concurrency conflict. |
| `archiveOutlet()`, `restoreOutlet()` | ID, versi, actor | Outlet terbaru | Mengubah status tanpa hard delete; arsip juga membersihkan outlet tersebut dari session aktif. |
| `selectActiveOutlet()` | Outlet ID, session, actor | Outlet terpilih | Memvalidasi cakupan, memperbarui session, dan menulis audit secara atomic. |
| `writeAdminAudit()` | Transaction dan snapshot audit | `void` | Menulis audit administratif di transaction pemanggil. |
| `getProvinces()`, `getRegencies()` | Kode provinsi jika diperlukan | Opsi wilayah | Membaca API wilayah dengan timeout, `no-store`, dan validasi response Zod. |
| `validateRegionSelection()` | Kode/nama provinsi dan kota | Nama/kode canonical | Memastikan pasangan wilayah form benar-benar berasal dari sumber wilayah. |
| Route Handler wilayah `GET()` | Request terautentikasi | JSON wilayah | Menjadi boundary server untuk API eksternal dan menolak role tanpa `outlet:manage`. |
| Action outlet dan `selectOutletAction()` | State dan FormData | State/redirect | Mengulang auth, permission, Zod, mutation, revalidation, serta redirect setelah pemilihan berhasil. |

## Staf, penugasan, dan password

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `assertStaffRoleAllowed()` | Role actor dan target | `void` atau error | Mencegah manager membuat manager serta mencegah cashier/staff melakukan pengelolaan. |
| `assertOutletAssignmentCount()` | Role staf dan outlet IDs | `void` atau error | Mewajibkan tepat satu outlet untuk kasir dan minimal satu untuk manager/staff. |
| `generateTemporaryPassword()` | Panjang opsional | Password acak | Membuat password minimum 12 karakter dengan uppercase, lowercase, angka, simbol, dan tanpa karakter ambigu. |
| `getStaff()` | Filter, page, actor | DTO halaman staf | Membaca staf sesuai cakupan role; manager hanya melihat kasir/staff yang berbagi outlet. |
| `getManageableOutlets()` | User ID dan role | Opsi outlet | Membatasi pilihan penugasan ke outlet aktif yang boleh dikelola actor. |
| `createStaff()` | Data staf dan actor | User dan password sementara | Meng-hash via Better Auth lalu membuat user, account, assignments, dan audit dalam satu transaction. |
| `updateStaff()` | Data, versi, actor | User terbaru | Mengubah nama/role/penugasan secara optimistic dan mengaudit assignment yang berubah. |
| `deactivateStaff()`, `reactivateStaff()` | Target dan actor | User terbaru | Mengubah status tanpa delete; deaktivasi mencabut seluruh session. |
| `resetStaffPassword()` | Target dan actor | User serta password sementara | Mengganti hash, menandai wajib ganti password, mencabut session, dan mengaudit tanpa menyimpan plaintext. |
| `changeOwnPassword()` | Password lama/baru, session, actor | `void` | Memverifikasi password, mengganti hash, membersihkan kewajiban, dan mencabut session lain secara atomic. |
| `getStaffPositions()` | Tidak ada | Maksimal 200 jabatan | Membaca jabatan global beserta status dan jumlah akun secara fresh untuk konfigurasi owner. |
| `createStaffPosition()`, `updateStaffPosition()`, `changeStaffPositionStatus()` | Nama/target/versi dan actor owner | Jabatan terbaru | Membuat, mengganti nama, mengarsipkan, atau memulihkan jabatan dalam transaction dengan optimistic concurrency dan admin audit tanpa menghapus referensi historis. |
| Action staf dan `changePasswordAction()` | State dan FormData | State/redirect | Memvalidasi permission/input dan hanya mengembalikan password sementara pada respons mutation pertama. |
| `OutletFormDialog()`, `StaffFormDialog()` | DTO dan hak actor | Dialog responsif | Menyusun form shadcn, state pending/error, wilayah, role, serta assignment aksesibel. |
| `OutletStatusAction()`, `StaffAccountActions()` | Snapshot entity | Form mutation | Menjalankan arsip/pemulihan atau deaktivasi/reset dengan optimistic version tersembunyi. |
| `CredentialSlip()` | Kredensial satu kali | Slip UI | Menyediakan copy/print lokal; plaintext tidak ditulis ke database atau log. |
| `ChangePasswordForm()`, `OutletSelector()` | Data session/outlet | Form interaktif | Mengelola visibility password, pending state, pemilihan outlet, dan feedback error. |
| `OutletsPage()`, `StaffPage()`, `SelectOutletPage()`, `ChangePasswordPage()` | Session/search params | Halaman dynamic | Menyusun route terlindungi dan UI responsif sesuai role serta state operasional. |

## Katalog: query, validasi, dan aturan bisnis

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `normalizeCatalogName()` | Nama katalog | String lowercase ternormalisasi | Membentuk kunci unik case-insensitive dengan Unicode NFKC, trim, dan spasi tunggal; tanpa side effect. |
| `normalizeCatalogLabel()` | Label katalog | String bersih | Mempertahankan kapitalisasi tampilan sambil merapikan Unicode dan spasi; tanpa side effect. |
| `normalizeSku()` | SKU opsional | SKU uppercase atau `null` | Menyamakan format SKU sebelum validasi dan penyimpanan. |
| `parseRupiahToMinorUnit()` | String Rupiah | String integer atau `null` | Memvalidasi nominal bulat tanpa operasi floating point. |
| `formatRupiah()` | String decimal database | String mata uang IDR | Memformat harga untuk UI Bahasa Indonesia; tanpa side effect. |
| `getProductMonogram()` | Nama produk | Inisial 1–2 huruf | Membentuk fallback code-native ketika gambar produk tidak tersedia atau gagal dimuat. |
| `getCatalogCategories()` | Flag untuk menyertakan arsip | Daftar DTO kategori | Membaca kategori beserta jumlah produk aktif/total secara dynamic. |
| `getCatalogProducts()` | Search/filter/page dan hak melihat arsip | DTO halaman produk | Menjalankan pencarian nama/SKU case-insensitive dan pagination 20 item di server. |
| `getCatalogProduct()` | Product ID | DTO produk atau `null` | Membaca detail produk yang sudah diserialisasi aman untuk UI. |
| `assertCatalogVersion()` | `updatedAt` aktual dan versi form | `void` atau error | Menolak optimistic concurrency conflict sebelum mutation. |
| `assertCategoryCanArchive()` | Jumlah produk aktif | `void` atau error | Menolak arsip kategori yang masih mempunyai produk aktif. |
| `assertProductCanRestore()` | Status kategori | `void` atau error | Menolak pemulihan produk ketika kategorinya masih diarsipkan. |

## Katalog: mutation dan audit

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `createCategory()` | Data kategori dan actor | Kategori baru | Membuat kategori dan audit `CREATE` dalam transaction yang sama. |
| `updateCategory()` | Data kategori, expected `updatedAt`, actor | Kategori terbaru | Memperbarui kategori secara optimistic dan mencatat `UPDATE`/`REORDER`. |
| `archiveCategory()` | ID, expected `updatedAt`, actor | Kategori arsip | Memastikan tidak ada produk aktif lalu mengarsipkan dan mengaudit secara atomic. |
| `restoreCategory()` | ID, expected `updatedAt`, actor | Kategori aktif | Memulihkan kategori tanpa menghapus histori. |
| `createProduct()` | Data produk dan actor | Produk baru | Memvalidasi kategori aktif, menyimpan Decimal, dan menulis audit dalam transaction. |
| `updateProduct()` | Data produk, expected `updatedAt`, actor | Produk terbaru | Memperbarui produk serta mencatat perubahan umum, harga, dan urutan secara terpisah. |
| `archiveProduct()` | ID, expected `updatedAt`, actor | Produk arsip | Mengarsipkan produk secara atomic dan menyimpan snapshot audit. |
| `restoreProduct()` | ID, expected `updatedAt`, actor | Produk aktif | Memastikan kategori aktif sebelum memulihkan produk dan menulis audit. |
| `executeCatalogAction()` | Schema, FormData, mutation, pesan | `CatalogActionState` | Memvalidasi `catalog:manageMaster`, input Zod, menjalankan mutation, lalu memanggil `revalidatePath` hanya setelah commit. |
| Action kategori dan produk | State dan FormData | State serializable | Delapan Server Action create/update/archive/restore; setiap pemanggilan mengulang autentikasi dan authorization. |
| `changeProductStatus()`, `updateCategoryStatus()` | Target, actor, status | Entity terbaru | Helper internal untuk perubahan status optimistic beserta timestamp arsip. |
| `requireActiveCategory()`, `findCategory()`, `findProduct()` | Transaction client dan ID | Record database | Membaca ulang sumber tepercaya di dalam transaction dan melempar domain error bila tidak sah. |
| `runCatalogMutation()` | Callback transaction | Hasil callback | Menjalankan seluruh mutation dalam Prisma transaction dan menerjemahkan konflik unique menjadi domain error. |
| `writeAudit()`, `writeChangeAudits()` | Snapshot, actor, action | `void` | Menulis audit dalam transaction yang sama; memisahkan perubahan harga dan urutan. |
| `categorySnapshot()`, `productSnapshot()`, `getChangedFields()` | Record sebelum/sesudah | JSON dan daftar field | Menyerialisasi Decimal/Date secara aman serta menentukan jenis audit yang diperlukan. |
| `serializeCatalogProduct()` | Record Prisma terpilih | DTO produk | Mengubah Decimal dan Date menjadi string sebelum data melewati batas Server Component. |
| `validateProductImage()` | File upload | MIME dan ekstensi tervalidasi | Membatasi hasil JPEG/PNG/WebP hingga 3 MB dan mencocokkan MIME dengan signature biner sebelum upload. |
| `saveProductImage()` | Product ID, file, actor | URL Blob | Mengunggah gambar baru, menyimpan URL dan audit secara atomic, mengompensasi blob baru jika database gagal, lalu membersihkan blob lama secara best-effort. |
| `removeProductImage()` | Product ID dan actor | `void` | Mengosongkan URL serta menulis audit dalam transaction sebelum menghapus blob lama secara best-effort. |
| `saveProductImagePosition()` | Product ID, posisi X/Y, actor | `void` | Menyimpan titik fokus 0–100 persen dan audit secara atomic untuk crop produk 1:1. |
| `saveProductImageAction()`, `removeProductImageAction()`, `saveProductImagePositionAction()` | State dan FormData | `CatalogActionState` | Mengulang permission owner, validasi input, mutation gambar, dan revalidation katalog/POS di server. |

## Katalog lanjutan dan override outlet

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `parseNonNegativeRupiah()` | String harga tambahan | String integer atau `null` | Memvalidasi nominal Rupiah non-negatif tanpa floating point dan tanpa side effect. |
| `parseOutletPercentage()` | String persen | Decimal string atau `null` | Menormalisasi koma/titik dan membatasi tarif 0–100 tanpa floating point. |
| `saveVariantGroup()`, `saveVariantOption()` | Data varian dan actor | Varian tersimpan | Membuat/mengubah grup serta opsi dalam transaction yang sama dengan audit. |
| `saveModifierGroup()`, `saveModifierOption()` | Data modifier dan actor | Modifier tersimpan | Mengelola pustaka modifier reusable serta audit perubahan harga. |
| `saveProductModifier()` | Produk, modifier, min/max | Relasi tersimpan | Memvalidasi jumlah opsi aktif lalu memasang aturan modifier secara atomic. |
| `changeAdvancedCatalogStatus()` | Entity, versi, status | Entity terbaru | Mengarsipkan/memulihkan tanpa hard delete dan menjaga minimum opsi yang masih dipakai. |
| `saveOutletProductOverride()`, `saveOutletVariantOverride()` | Outlet, entity, availability, harga | Override atau reset | Memvalidasi penugasan outlet, menyimpan override sparse, serta mengaudit reset/perubahan. |
| `getAdvancedProduct()` | Product ID | DTO konfigurasi | Membaca product, seluruh grup varian, dan modifier terpasang tanpa N+1 query. |
| `getModifierGroups()` | Flag arsip | Pustaka modifier | Membaca grup dan opsi terurut sebagai DTO serializable. |
| `getAccessibleCatalogOutlet()` | Outlet, user, role | Konteks outlet atau `null` | Menolak outlet di luar assignment dan menyerialisasi tarif pajak/layanan. |
| `getOutletCatalogProducts()` | Filter dan outlet | Halaman produk efektif | Menggabungkan master dengan override harga/ketersediaan produk serta opsi varian. |
| Action katalog lanjutan | State dan FormData | `CatalogActionState` | Mengulang session, permission master/outlet, Zod, mutation, dan revalidation di server. |
| `CatalogScopeSelect()` | Outlet dan scope | Selector client | Menampilkan pilihan baru secara optimistis, memberi status loading, lalu berpindah antara master dan outlet melalui URL dengan prop server sebagai sumber kebenaran. |
| `ProductOptionsPage()` | Product ID | Halaman editor | Menyusun editor varian serta modifier owner-only secara responsif. |
| `ModifierLibraryPage()` | Tidak ada | Halaman pustaka | Menyusun pengelolaan modifier reusable khusus owner. |
| `OutletCatalogProductCard()` | Produk efektif dan hak edit | Card responsif | Menampilkan harga efektif serta form override produk/varian untuk outlet. |

## Transaksi POS

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `calculateSaleTotals()` | Subtotal Decimal, tarif layanan/pajak, flag harga inklusif | Snapshot total Decimal | Menghitung layanan, pajak, dan total dengan pembulatan half-up ke Rupiah tanpa floating point. |
| `getPosMenu()` | Outlet, user, role | `PosMenu` atau `null` | Membaca maksimal 300 produk aktif beserta harga override, varian, modifier, dan konfigurasi struk terbaru pada outlet. |
| `getSalesPage()` | Outlet, halaman, filter sumber/settlement/status | Halaman transaksi | Membaca 20 transaksi terbaru per halaman beserta status dan total refund tanpa cache persisten. |
| `getSaleDetail()` | Sale ID dan outlet aktif | Detail struk atau `null` | Membatasi detail struk ke outlet aktif serta menyerialisasi snapshot, sisa item, dan ledger koreksi. |
| `createSale()` | Checkout tervalidasi dan actor | Hasil checkout | Menjalankan validasi harga fresh, nomor struk, sale, item, pembayaran, dan audit dalam transaction serializable; checkout token membuat retry idempoten. |
| `resolveCheckoutItems()` | Prisma transaction dan cart | Snapshot item | Memvalidasi status produk, override, satu varian per grup, min/max modifier, serta harga yang dilihat kasir. |
| `resolvePayment()` | Checkout dan total | Data pembayaran | Memastikan uang tunai cukup dan menghitung kembalian; non-tunai menyimpan referensi opsional. |
| `getBusinessDate()` | Zona waktu outlet | Tanggal bisnis dan token struk | Mengubah waktu saat ini menjadi tanggal operasional outlet tanpa menyimpan waktu lokal sebagai UTC palsu. |
| `findIdempotentSale()`, `serializeSaleResult()` | Token/record sale | Hasil action | Mengembalikan transaksi retry milik actor yang sama dan menolak token milik actor lain. |
| `checkoutSaleAction()` | Payload Client Component | `CheckoutActionState` | Memvalidasi Zod, session, permission `pos:operate`, menjalankan service, lalu merevalidasi riwayat. |
| `PosRegister()` | Menu outlet | Register interaktif | Mengelola toolbar pencarian, rail kategori yang dapat disembunyikan, grid produk dengan indikator jumlah, penggabungan item identik, cart lokal, konfigurasi item, dan pembukaan checkout. |
| `hasSameCartConfiguration()`, `hasSameSelection()` | Dua konfigurasi cart | Boolean | Menggabungkan produk, varian, modifier, dan catatan yang sama; konfigurasi berbeda tetap menjadi baris terpisah. |
| `ProductConfigurator()` | Produk dan callback cart | Dialog pilihan | Mengumpulkan satu pilihan per grup varian, modifier sesuai batas, jumlah, dan catatan item. |
| `CartPanel()` | Cart, total preview, callback | Ticket rail | Menampilkan item, kontrol jumlah/hapus, pajak/layanan, dan CTA pembayaran pada desktop/mobile. |
| `CheckoutDialog()` | Cart, menu, total, state dialog | Dialog pembayaran dan struk | Mengumpulkan jenis order, meja, metode, tunai/referensi, memanggil action, lalu mempertahankan dialog untuk menampilkan transaksi berhasil tanpa berpindah halaman. |
| `ReceiptPreview()` | Menu outlet, snapshot checkout, callback tutup | Struk transaksi | Menampilkan preview setelah checkout, membaca preferensi auto-print perangkat setelah render, dan mempertahankan tombol cetak manual. |
| `parseMoneyToMinor()`, `minorToMoney()`, `formatMinor()` | String atau integer minor unit | Bentuk uang lain | Menjaga kalkulasi preview sebagai integer minor unit dan memakai `Intl` hanya untuk tampilan. |
| `calculateClientTotals()`, `parseRate()`, `roundDivide()`, `maxMinor()` | Minor unit dan tarif | Preview checkout | Menyamakan urutan serta pembulatan preview client dengan server tanpa menjadikannya sumber kebenaran. |
| `formatRate()`, `productMonogram()` | Rate atau nama | Label UI | Membuat label persentase dan marker dua huruf tanpa asset gambar. |
| `PosLayout()`, `TransactionsLayout()` | Child route | Shell workspace | Mempertahankan sidebar/app bar/bottom navigation saat konten POS melakukan loading. |
| `PosPage()`, `TransactionsPage()`, `SaleDetailPage()` | Session, outlet, route/search params | Halaman dynamic | Memeriksa permission dan outlet aktif dekat sumber data sebelum merender register atau struk. |
| `PosLoading()`, `TransactionsLoading()` | Tidak ada | Skeleton konten | Menampilkan loading hanya pada bagian yang mengambil data sehingga navigasi tetap interaktif. |
| `formatSaleDate()`, `paymentLabel()` | Timestamp/metode | Label transaksi | Menampilkan waktu dalam zona outlet dan nama metode dalam Bahasa Indonesia. |
| `orderLabel()`, `transactionPageHref()` | Sale dan filter aktif | Label/URL | Menampilkan sumber order serta mempertahankan filter ketika halaman transaksi berubah. |

## Printer struk browser

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `printerSettingsSchema` | Outlet ID, `MM58`/`MM80`, footer | Input terpangkas atau error | Membatasi ukuran kertas dan menolak footer lebih dari 160 karakter setelah spasi tepi dihapus. |
| `getPrinterSettings()` | Outlet, user, role | Konfigurasi atau `null` | Membaca konfigurasi fresh hanya untuk outlet aktif yang dimiliki atau ditugaskan. |
| `updatePrinterSettings()` | Input tervalidasi dan actor | `PrinterSettingsActionState` | Memeriksa role/assignment lalu memperbarui outlet dan audit before/after dalam satu transaction. |
| `updatePrinterSettingsAction()` | Payload Client Component | `PrinterSettingsActionState` | Memeriksa permission `settings.manage`, active-outlet scope, validasi, service, dan revalidation `/settings/printers` serta `/pos`. |
| `getAutoPrintStorageKey()` | Outlet ID | Key local storage | Membentuk namespace `glutong:printer:auto-print:<outletId>`. |
| `getAutoPrintPreference()`, `setAutoPrintPreference()`, `subscribeAutoPrintPreference()` | Outlet dan boolean/callback | Preferensi, status penyimpanan, atau cleanup | Membaca/menulis opt-in per browser, menyinkronkan external store dalam/lintas tab, dan memakai fallback manual saat storage gagal. |
| `ReceiptRenderer()` | Outlet dan snapshot struk | Markup struk bersama | Merender markup identik untuk preview settings, checkout, 58 mm, dan 80 mm tanpa mutation. |
| `formatRupiah()`, `formatRupiahFromMinor()` | Decimal canonical atau integer minor unit | Rupiah bulat terformat | Menyatukan tampilan Rupiah tanpa digit desimal di seluruh aplikasi tanpa mengubah nilai sumber. |
| `formatReceiptMinor()` | Integer minor unit | Rupiah terformat | Memformat nominal tampilan struk melalui formatter Rupiah bersama tanpa dipakai sebagai sumber kalkulasi. |
| `PrinterSettingsForm()` | Konfigurasi outlet | Form dan preview responsif | Mengelola ukuran/footer outlet, toggle perangkat, preview langsung, pending state, dan cetak contoh. |
| `PrinterSettingsPage()`, `PrinterSettingsLoading()` | Session/outlet atau tanpa input | Halaman dynamic/skeleton | Melindungi route dengan permission dan menjaga bentuk form plus preview saat navigasi loading. |

## Absensi karyawan

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `parseAttendanceEnvironment()`, `parseAttendanceEmbeddingEnvironment()`, `parseAttendanceBlobEnvironment()` | Object environment | Credential absensi tervalidasi | Memvalidasi credential secara lazy dan terpisah; enrollment hanya memerlukan key AES base64 32 byte, sedangkan bukti foto hanya memerlukan token Blob. |
| `normalizeEmbedding()`, `averageEmbeddings()`, `faceSimilarity()` | Sampel/probe embedding | Template normal atau similarity | Menolak nilai non-finite, merata-ratakan tepat tiga sampel, serta menghitung cosine similarity tanpa menyimpan probe. |
| `encryptEmbedding()`, `decryptEmbedding()` | Embedding dan key opsional | Ciphertext/IV atau embedding | Mengenkripsi template memakai AES-256-GCM beserta authentication tag dan menolak payload/key yang berubah. |
| `createAttendanceNonce()`, `hashAttendanceNonce()` | Tidak ada atau nonce | Nonce acak atau hash SHA-256 | Membentuk challenge sekali pakai; database hanya menyimpan hash. |
| `getSharedDevicePreference()`, `setSharedDevicePreference()`, `subscribeSharedDevicePreference()` | Boolean/callback browser | Preferensi, status simpan, atau cleanup | Menyimpan logout otomatis per browser, menyinkronkan tab, dan kembali nonaktif ketika local storage tidak tersedia. |
| `distanceInMeters()`, `businessDateAt()` | Dua koordinat atau timestamp/timezone | Jarak meter atau tanggal bisnis | Menggunakan Haversine serta kalender lokal outlet tanpa menjadikan waktu browser sebagai sumber kebenaran. |
| Schema attendance | Payload enrollment/challenge/verify/settings/review/correction/report | Input tervalidasi atau error | Membatasi embedding, koordinat, radius 50–500 m, alasan, timestamp koreksi, dan filter laporan pada trust boundary. |
| `uploadAttendanceEvidence()`, `readAttendanceEvidence()`, `deleteAttendanceEvidence()` | JPEG/Path private | Path, stream, atau void | Memvalidasi JPEG maksimal 300 KB dan memakai Blob private tanpa mengekspos URL storage ke UI. |
| `enrollFaceProfile()`, `reviewFaceReenrollment()`, `revokeFaceProfile()` | Tiga sampel, keputusan review, atau user target dan actor | Profil, request pending, hasil review, atau void | Mengaktifkan pendaftaran pertama, menahan daftar ulang kasir/staff sampai disetujui owner/manager, mengganti profil secara atomik, menghapus payload pending setelah keputusan, memeriksa scope, dan menulis audit. |
| `createAttendanceChallenge()` | Outlet, jenis, konfirmasi di luar jadwal, actor | Nonce/action 15 menit | Memeriksa assignment dan roster; saat check-in baru dimulai setelah batas tanggal outlet, sesi lama ditutup tanpa waktu pulang sebagai `MISSED_CHECKOUT` beserta audit sebelum challenge dibuat. |
| `verifyAttendance()` | Probe, liveness, GPS, nonce, idempotency, JPEG, actor | Hasil attempt/sesi | Mengunggah bukti privat, memverifikasi akun `1:1`, menyimpan similarity dan jarak untuk attempt sukses/gagal yang sempat dihitung, lalu check-in/out dalam transaction serializable; retry aman melalui idempotency key. |
| `requestAttendanceException()`, `reviewAttendanceException()` | Verification/alasan atau keputusan, actor | Request/review | Membuka permintaan setelah kegagalan ketiga, membatasi scope manager, menolak self-approval, dan memakai waktu attempt asli saat disetujui. |
| `correctAttendanceSession()` | Session, timestamp efektif, alasan, actor | Correction | Menambahkan ledger koreksi dan audit tanpa menimpa waktu asli. |
| `updateAttendanceSettings()` | Geofence, toleransi jadwal, dan actor | `void` | Memperbarui outlet aktif/assigned dan audit before/after dalam satu transaction. |
| `cleanupExpiredAttendanceEvidence()` | Batas batch | Jumlah scan/hapus | Menghapus foto kedaluwarsa secara best effort, menandai record sukses, dan menulis audit sistem. |
| `getAttendanceHome()`, `getAttendanceManagement()`, `getAttendanceSettings()` | User/outlet/actor/page | DTO serializable | Membaca profil, status/request daftar ulang, outlet tugas, sesi, roster pribadi, exception, staf, serta geofence secara fresh dan bounded tanpa mengirim payload biometrik. |
| `getAttendanceEvidencePath()`, `getAttendanceExportRows()` | Attempt/filter dan actor | Path/rows atau penolakan | Mengulang ownership/assignment dan membatasi ekspor maksimal 10.000 baris di Route Handler. |
| Attendance Route Handlers | Request enrollment/challenge/verify/evidence/export/cron | JSON, stream, atau CSV | Mengulang session, permission, validasi, no-store, scope, dan secret cron pada server. |
| Attendance Server Actions | Input exception/review daftar ulang/correction/revoke/settings | `AttendanceActionState` | Mengulang permission dan actor dari session, memanggil domain service, lalu me-revalidate route terdampak. |
| `AttendanceClock()` | Akun dan DTO absensi/roster | UI kamera/lokasi | Memuat Human secara lazy dengan WebGL/WASM fallback, menampilkan dua minggu jadwal, meminta konfirmasi di luar jadwal, serta mengelola tiga sampel, liveness, geolocation, bukti JPEG, pengecualian, dan logout tablet bersama. |
| `AttendanceMap()`, `MapViewport()` | Koordinat/radius dan callback | Peta editor | Menyinkronkan marker pusat, handle radius, input luar, dan viewport dengan target drag sentuh serta attribution OSM. |
| `AttendanceSettingsForm()` | Konfigurasi outlet | Form/peta responsif | Menyatukan lokasi terkini, koordinat manual, radius, toleransi terlambat/pulang cepat, status aktif, pending, serta feedback simpan. |
| `AttendanceManagement()` | Queue, sessions, profiles/request, outlet | Workspace review/report | Menyediakan kartu mobile, tabel desktop, similarity kalibrasi wajah, review daftar ulang, bukti privat, koreksi, revoke, dan filter ekspor tanpa overflow horizontal. |
| Attendance pages/loading | Session, active outlet, search params | Route dynamic/skeleton | Melindungi route absensi, pengelolaan, pengaturan, dan roster dengan permission serta menjaga bentuk final pada mobile, tablet, dan desktop. |
| `mondayOf()`, `addIsoDays()`, `scheduledRange()`, `isWithinScheduledWindow()`, `hasMissedCheckoutDeadlinePassed()` | Tanggal/jam/zona waktu | Tanggal, rentang UTC, atau status batas | Membentuk minggu Senin–Minggu, shift normal/lintas tengah malam, jendela check-in dua jam, dan batas tidak absen pulang berdasarkan kalender outlet. |
| `attendanceDisplay()` | Jadwal, toleransi, waktu efektif, dan waktu kini | Status serta menit/jam | Menghasilkan status terjadwal, belum masuk, tepat waktu, terlambat, pulang cepat, tidak absen pulang tanpa durasi, tidak hadir, atau di luar jadwal. |
| Schema roster | Template/draf/publish/salin/revisi/tambah | Input tervalidasi | Membatasi jam, tanggal minggu, satu shift per staf/tanggal, versi optimistic, dan alasan perubahan jadwal terbit. |
| `createShiftTemplate()`, `updateShiftTemplate()`, `changeShiftTemplateStatus()` | Template outlet dan actor | Template terbaru | Mengelola template shift scoped outlet dalam transaction dan mempertahankan snapshot roster yang sudah diterbitkan. |
| `saveRosterDraft()`, `copyRosterWeek()`, `publishRosterWeek()` | Minggu/entries/versi dan actor | Roster week | Memvalidasi staf, jabatan, assignment, template, serta konflik global lalu menyimpan snapshot dan audit secara atomik. |
| `updatePublishedRosterEntry()` | Entry, shift pengganti atau Libur, alasan, versi | Entry terbaru atau `null` | Mengganti atau menghapus hanya shift masa depan pada roster terbit dan menyimpan before/after beserta alasan dalam audit. |
| `addPublishedRosterEntry()` | Minggu, outlet, staf, tanggal, template, versi, alasan | Entry baru | Mengubah sel Libur masa depan menjadi shift setelah memvalidasi versi minggu, scope outlet, assignment, jabatan, template, konflik global, dan audit dalam transaction serializable. |
| `getRosterWorkspace()`, `getPublishedRosterForUser()`, `getAttendanceRosterSummary()` | Outlet/user/week/actor | DTO roster | Membaca editor outlet, dua minggu jadwal pribadi, dan ringkasan status hari ini secara fresh dan permission-scoped. |
| `RosterPlanner()` | Outlet, staf, template, minggu | Papan/kartu roster | Menyediakan pengelolaan template aktif, draf, salin, publish, tambah/ganti/Libur pada jadwal terbit, papan desktop, dan kartu hari tablet/mobile tanpa overflow horizontal. |

## Void dan refund transaksi

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `voidSale()`, `refundSale()` | Input tervalidasi dan actor owner/manager | `TransactionActionState` | Menjalankan koreksi append-only dalam transaction serializable, memperbarui status, dan menulis audit tanpa mengubah snapshot sale/payment. |
| `createSaleCorrection()` | Tipe void/refund, input, actor | Hasil koreksi | Memeriksa outlet, status, settlement, idempotency, shift tunai, saldo kas, item tersisa, dan konflik concurrent. |
| `resolveSelectedItems()` | Item sale, request, refund sebelumnya | Item terpilih | Menolak item asing atau kuantitas yang melebihi sisa serta menghitung subtotal dari unit price snapshot. |
| `validateCorrectionState()` | Tipe, status, tanggal bisnis | `void` atau error | Membatasi void ke transaksi utuh pada tanggal bisnis yang sama dan menolak transaksi yang sudah dikoreksi penuh. |
| `allocateCorrectionAmounts()` | Snapshot sale/payment dan item refund | Nilai `Decimal` teralokasi | Mengalokasikan layanan, pajak, fee, net, dan pembanding direct tanpa floating point; refund terakhir menerima residue pembulatan. |
| `findIdempotentCorrection()` | Token, sale, outlet, tipe, actor | Hasil tersimpan atau `null` | Mengembalikan retry milik actor yang sama dan menolak penggunaan token lintas transaksi. |
| `voidSaleAction()`, `refundSaleAction()` | State dan FormData | `TransactionActionState` | Mengulang permission `transaction:correct`, active-outlet scope, Zod, mutation, dan revalidation layar finansial. |
| `TransactionCorrectionControls()` | Detail sale, outlet, hak void | Kontrol responsif | Menampilkan dialog void/refund dengan alasan, jumlah item, referensi provider, pending state, error inline, dan token baru. |
| `StatusBadge()`, `StatusIcon()` | Status sale | Label dan ikon | Menampilkan status selesai/refund/void tanpa mengandalkan warna saja. |

## Shift kasir dan tutup kas

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `getOutletBusinessDate()` | Timestamp dan zona waktu outlet | Tanggal UTC untuk kolom PostgreSQL `date` | Menetapkan tanggal bisnis dari kalender lokal outlet tanpa menutup shift saat tengah malam. |
| `openCashShift()` | Outlet, saldo awal, token, actor | `ShiftActionState` | Membuka satu shift pribadi global, menyimpan saldo `Decimal`, dan menulis audit dalam transaction serializable. |
| `requireOpenCashShift()` | Prisma transaction, user, outlet | Shift aktif | Menjadi guard checkout atomik dan menolak transaksi tanpa shift atau pada outlet yang berbeda. |
| `addCashMovement()` | Shift, arah, kategori, nominal, alasan, token, actor | `ShiftActionState` | Menambahkan movement immutable hanya pada shift terbuka milik actor dan menulis audit. |
| `closeCashShift()`, `forceCloseCashShift()` | Shift, kas aktual, token, actor, alasan paksa | Hasil rekonsiliasi | Menjalankan blind close, menyimpan expected/actual/difference, melepaskan kunci shift user, dan mengaudit penutupan. |
| `correctCashShiftReconciliation()` | Shift tertutup, kas aktual benar, alasan, token, actor owner/manager | Nilai efektif terbaru | Menambahkan revision append-only, menghitung ulang selisih terhadap expected asli, menjaga idempotensi/scope, dan menulis audit tanpa mengubah snapshot penutupan. |
| `calculateExpectedCash()` | Transaction, shift, saldo awal | Total tunai `Decimal` | Menghitung saldo awal + penjualan tunai + kas masuk - kas keluar - refund tunai; pembayaran non-tunai tidak memengaruhi drawer. |
| `isTransactionWriteConflict()` | Error Prisma/adapter | Boolean | Mengenali `P2034` dan `DriverAdapterError` Neon agar transaksi serializable dapat di-retry. |
| `getCurrentCashShift()`, `hasCurrentCashShift()` | User ID | Shift aktif atau boolean | Membaca shift global user secara fresh untuk gate POS dan peringatan logout. |
| `getCashShiftPage()` | Outlet, actor, halaman, status | Halaman shift | Membatasi data sesuai role/outlet, memisahkan shift terbuka dan riwayat, memakai pagination, serta menerapkan koreksi rekonsiliasi terbaru sebagai nilai efektif. |
| `getCashShiftDetail()` | Shift, outlet, actor, halaman transaksi | Detail shift | Merangkum pembayaran, movement, audit, koreksi, dan transaksi; total shift sendiri disembunyikan selama masih terbuka. |
| Action shift | State dan FormData | `ShiftActionState` | Memvalidasi session, permission, Zod, actor tepercaya, mutation idempoten, lalu merevalidasi layar terdampak. |
| `OpenShiftCard()`, `WrongOutletShiftCard()`, `PosShiftBar()` | Outlet atau shift aktif | Gate/status POS | Mewajibkan pembukaan shift, memblokir outlet yang salah, dan menyediakan kontrol kas responsif. |
| `CashMovementDialog()`, `CloseShiftDialog()`, `ForceCloseShiftDialog()`, `CashShiftCorrectionDialog()` | Shift dan permission | Dialog mutation | Mengumpulkan movement, blind count, force-close, atau koreksi aktual pascapenutupan dengan token idempotensi dan alasan wajib. |
| `ShiftsPage()`, `CashShiftDetailPage()` | Session, outlet, route/search params | Halaman dynamic | Menyusun riwayat serta rincian shift yang fresh untuk mobile, tablet, dan desktop. |
| `runShiftE2E()` | Flag database test | Exit process | Menjalankan alur live shift pada server/folder build terisolasi, mengambil screenshot responsif, dan membersihkan fixture. |

## Channel ojol dan settlement

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `calculateChannelPrice()` | Harga direct, markup, unit pembulatan | Harga channel Decimal | Menaikkan harga secara proporsional dan membulatkan harga positif ke kelipatan Rp500 berikutnya. |
| `calculateExpectedSettlement()` | Gross dan estimasi fee | Fee dan net Decimal | Menghitung estimasi penerimaan dengan pembulatan half-up ke Rupiah. |
| `calculateSettlementNet()` | Gross, fee, promo, penyesuaian | Net Decimal | Menjadi satu rumus otoritatif untuk validasi transfer platform. |
| `saveDeliveryChannel()` | Konfigurasi outlet dan actor | Channel tersimpan | Memvalidasi scope outlet, upsert konfigurasi, dan menulis audit dalam transaction. |
| `saveChannelProductPrice()` | Channel, produk, harga opsional, actor | Override atau `null` | Menyimpan harga final kelipatan Rp500 yang lebih tinggi dari harga outlet, atau menghapus override. |
| `createSettlementBatch()` | Transaksi pending, rincian transfer, actor | Batch settlement | Memastikan satu channel/outlet, mengurangi refund dari piutang, menyeimbangkan net, menandai pembayaran settled, dan menulis audit atomically. |
| `reverseSettlementBatch()` | Batch, alasan, actor owner | Batch reversed | Mengembalikan pembayaran ke pending tanpa menghapus batch atau jejak audit. |
| `requireOutletAccess()` | Prisma transaction, outlet, actor | `void` | Menolak operasi di luar outlet penugasan manager; owner dapat mengakses seluruh outlet. |
| `channelSnapshot()`, `settlementSnapshot()` | Record Decimal | JSON audit | Menserialisasi nilai keuangan tanpa melewatkan object Prisma internal. |
| `getDeliveryManagement()` | Outlet, user, role | DTO pengelolaan | Membaca konfigurasi, maksimal 300 produk, 500 piutang terdekat, 20 batch terbaru, dan agregat keuangan fresh. |
| `getSupportedDeliveryProviders()` | Tidak ada | Daftar provider | Menjaga tiga kartu provider tetap tersedia sebelum konfigurasi database dibuat. |
| Action settlement | State dan FormData | `DeliveryActionState` | Mengulang Zod, session, permission, actor tepercaya, mutation, dan revalidation route di server. |
| `DeliveryManagement()` | Outlet, DTO, permission | Workspace responsif | Menyusun ringkasan piutang, pengaturan channel/harga, rekonsiliasi, dan riwayat batch. |
| `SettlementsPage()`, `SettlementsLayout()`, `SettlementsLoading()` | Session dan outlet aktif | Halaman/shell/skeleton | Menjaga authorization, navigasi persisten, dan loading hanya pada konten settlement. |
| `ChannelConfigForm()`, `ProductPriceOverrideForm()` | Konfigurasi dan produk | Form owner | Mengubah markup/fee/delay serta pengecualian harga sambil memperlihatkan estimasi net dan selisih. |
| `SettlementForm()` | Channel dan pembayaran pending | Form batch | Memilih transaksi, menghitung gross/net preview, dan mengirim rincian transfer aktual. |
| `ReverseSettlementForm()` | Outlet dan batch | Form pembalikan | Mengumpulkan alasan eksplisit sebelum owner membalik settlement. |
| `SummaryCard()`, `NumberField()`, `MoneyField()`, `ReadOnlyMoney()` | Nilai tampilan/form | Komponen UI | Menjaga metric serta input keuangan konsisten dan responsif tanpa dependency baru. |
| `useActionToast()` | Action state | Side effect toast | Menampilkan hasil mutation menggunakan provider notifikasi global. |
| `moneyValue()`, `formatRupiah()`, `formatDate()`, `toLocalDateTime()`, `toIsoDateTime()` | Nilai form/tanggal | String terformat | Menormalisasi input Rupiah dan waktu lokal browser sebelum melewati Server Action. |

## Open order dan kitchen ticket

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `saveOpenOrder()` | Cart, outlet, tipe order, meja, token, actor | `OrderActionState` | Menyimpan order belum lunas beserta harga fresh, item snapshot, shift pembuka, versi, dan audit dalam transaction serializable. |
| `updateOpenOrder()` | Order, expected version, cart terbaru, alasan pengurangan, actor | `OrderActionState` | Menjalankan optimistic concurrency, mempertahankan item yang pernah dikirim, memperbarui harga/totals, dan mencatat audit. |
| `refreshOpenOrderPricing()` | Order, expected version, token, actor | `OrderActionState` | Menerapkan harga dan konfigurasi outlet terbaru setelah konfirmasi eksplisit tanpa membuat delta dapur palsu. |
| `sendOrderToKitchen()` | Order, expected version, token, actor | `OrderActionState` | Membuat initial/delta ticket idempoten, menyimpan snapshot terakhir terkirim, dan mengaudit pengiriman. |
| `buildKitchenDelta()` | Snapshot item saat ini dan terakhir terkirim | Daftar line ticket | Menghasilkan `ADD`, `UPDATE`, atau `REMOVE`; pengurangan tanpa alasan ditolak. |
| `cancelOpenOrder()` | Order, expected version, token, alasan, actor | `OrderActionState` | Membatalkan order tanpa hard delete, melepaskan meja aktif, menulis audit, dan membuat delta pembatalan jika dapur sudah menerima item. |
| `updateKitchenTicketStatus()` | Ticket, outlet, status berikutnya, actor | `OrderActionState` | Memvalidasi scope outlet dan memajukan ticket Baru → Diproses → Selesai secara berurutan. |
| `updateOpenOrderSetting()` | Outlet, flag enable, actor owner/manager | `OrderActionState` | Mengubah kemampuan simpan order per outlet dan menulis admin audit. |
| `getOpenOrders()`, `getKitchenTickets()`, `getOutletOperations()` | Outlet, user, role | DTO serializable | Membaca data operasional fresh, terbatas outlet serta jumlah record, tanpa persistent cache. |
| Action order, kitchen, dan settings | Input unknown dari Client Component | Hasil success/error/conflict | Mengulang validasi Zod, session, permission, actor tepercaya, mutation, dan revalidation di server. |
| `OrderSaveDialog()`, `OpenOrdersDialog()`, `CheckoutDialog()` | Cart/order/menu | Alur POS interaktif | Menyimpan, melanjutkan, mengirim, membatalkan, mengonfirmasi harga, dan membayar order tanpa memperbesar canvas POS. |
| `updateLineNote()`, `ItemNoteDialog()` | Item cart dan catatan maksimal 240 karakter | Cart lokal terbarui | Menambah, mengubah, atau menghapus catatan tanpa mengubah identitas, opsi, jumlah, atau harga item; persistence tetap melalui simpan order. |
| `KitchenBoard()` | Ticket fresh outlet aktif | Antrean tiga status | Menampilkan kartu initial/delta responsif dan pending state lokal tanpa overflow horizontal. |
| `OutletOperationsForm()` | Outlet dan nilai awal | Form toggle | Memberi owner/manager kontrol operasional dengan feedback pending/sukses/error. |
| `KitchenPage()`, `SettingsPage()` | Session dan outlet aktif | Halaman dynamic | Menjaga authorization server, data fresh, serta shell responsif mobile/tablet/desktop. |
| `runOrderE2E()` | Flag persetujuan dan environment database | Exit process | Membuat fixture order unik, menjalankan journey live multi-session/lintas shift, lalu membersihkan seluruh row milik run di blok `finally`. |

## Laporan operasional dan keuangan

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `parseReportSearch()` | View, tanggal, dan outlet dari URL | Hasil validasi Zod | Membatasi format tanggal, jenis laporan, serta rentang maksimum 366 hari tanpa side effect. |
| `getReportOutlets()`, `selectReportOutlets()` | User, role, outlet request/session | Outlet yang dapat dilaporkan | Membaca outlet aktif sesuai assignment lalu memilih satu atau seluruh outlet yang sah. |
| `getReportDataset()` | View, filter, batas baris | Dataset report terdiskriminasi | Menjalankan hanya query report aktif dengan pembacaan fresh dan batas detail eksplisit. |
| `getOverviewReport()` | Tanggal dan outlet | Ringkasan, tren, sumber order | Mengagregasi snapshot penjualan berdasarkan business date dan koreksi berdasarkan tanggal pelaksanaan lokal. |
| `getProductReport()`, `getPaymentReport()` | Tanggal dan outlet | Baris produk atau pembayaran | Menggabungkan bruto periode penjualan dengan refund periode koreksi tanpa floating point. |
| `getShiftReport()`, `getCorrectionReport()`, `getSettlementReport()` | Tanggal, outlet, batas baris | Detail bounded dan ringkasan | Membaca rekonsiliasi shift, ledger koreksi, piutang, serta batch settlement secara fresh. |
| `buildOverviewReport()`, `buildProductRows()`, `buildPaymentRows()` | Agregat database serializable | DTO laporan | Menyatukan gross/refund/void menggunakan Prisma Decimal dan menjaga refund lintas tanggal dapat menghasilkan nilai net negatif. |
| `createReportCsv()`, `escapeCsvCell()`, `getReportCsvRowCount()` | Dataset dan filter | CSV serta jumlah baris | Membentuk ekspor per view, mengutip delimiter, dan menetralkan formula spreadsheet. |
| Route report export `GET()` | Request dengan filter laporan | CSV atau JSON error | Mengulang validasi session, permission, outlet, tanggal, batas 10.000 baris, lalu mengirim CSV non-cache. |
| `ReportsPage()`, `ReportsLoading()`, `ReportsError()` | Session dan URL report | Route dynamic, skeleton, atau retry | Menjaga shared shell, data fresh, loading berbentuk akhir, dan pemulihan error lokal. |
| `ReportDashboard()`, `ReportFilters()`, `SummaryGrid()` | Selection, outlet, overview, dataset | Workspace laporan responsif | Menyusun filter URL, preset periode, KPI ledger, tab, serta tautan CSV tanpa state client tambahan. |
| `ReportView()`, `OverviewView()`, `ProductsView()`, `PaymentsView()`, `ShiftsView()`, `CorrectionsView()`, `SettlementsView()` | Dataset terpilih | Tampilan report | Merender kartu mobile dan tabel layar lebar sesuai jenis data tanpa overflow horizontal. |
| `SalesPulse()`, `MetricCard()`, `LedgerValue()`, `TruncationNotice()`, `EmptyReport()` | Nilai laporan | Primitive presentasi | Menyajikan tren SVG native, nilai presisi, batas hasil, dan empty state yang tetap aksesibel. |

## Interaksi pengguna

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `LoginForm()` | Tidak ada | Form login interaktif | Mengelola validasi, pending state, pesan error generik, dan navigasi setelah login. |
| `handleSubmit()` | Submit event form | Promise | Memvalidasi email/password, memanggil Better Auth, lalu menuju workspace; tidak membedakan email yang terdaftar dan tidak. |
| `handlePasswordVisibility()` | Tidak ada | `void` | Mengganti input kata sandi antara tersembunyi dan terlihat. |
| `ThemeToggle()` | `className` opsional | Pemilih tema | Menampilkan pilihan terang/sistem/gelap dan menyimpan pilihan melalui `next-themes`. |
| `handleThemeChange()` | Nama tema | `void` | Memperbarui dan menyimpan tema pengguna. |
| `subscribeToHydration()` | Tidak ada | Unsubscribe function | Memberi `useSyncExternalStore` snapshot hydration tanpa effect/setState tambahan. |
| `SignOutButton()` | Tidak ada | Tombol keluar | Menampilkan pending state dan feedback kegagalan logout. |
| `handleSignOut()` | Tidak ada | Promise | Menghapus session lewat Better Auth lalu membuka ulang `/sign-in` agar state autentikasi bersih. |

## Route dan komposisi tampilan

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `RootLayout()` | `children` | Dokumen HTML | Memasang metadata, font, Bahasa Indonesia, theme provider, dan satu toast region global. |
| `HomePage()` | Tidak ada | Redirect | Membaca session dan mengarahkan ke sign-in atau workspace. |
| `SignInPage()` | Tidak ada | Halaman login | Merender brand rail statis dan form login client-side. |
| `WorkspacePage()` | Search params | Workspace terlindungi | Memvalidasi `workspace:view`, menampilkan identitas/role, dan waktu Asia/Jakarta. |
| `DesignSystemPage()` | Tidak ada | Showcase terlindungi | Memvalidasi `designSystem:view` sebelum merender referensi token dan komponen. |
| `proxy()` | `NextRequest` | `NextResponse` | Melakukan redirect optimistis dari keberadaan cookie saja; tidak menjadi kontrol authorization. |
| `BrandMark()` | Opsi inverse/compact/class | Wordmark | Merender identitas code-native tanpa asset gambar eksternal. |
| `ServiceTicketRail()` | Tidak ada | Ordered list | Menjelaskan urutan Masuk → Periksa → Melayani khusus layar login. |
| `WorkspaceShellLayout()` | Child route operasional | Shell workspace terlindungi | Membaca session fresh dan mempertahankan satu `WorkspaceHeader` saat pengguna berpindah di antara seluruh route operasional. |
| `WorkspaceHeader()` | Role, permission navigasi, dan outlet aktif | Shell navigasi responsif | Menyusun sidebar desktop yang dapat diperkecil, app bar serta bottom navigation mobile, menampilkan label role aktual, pemilih outlet, tema, dan logout tanpa mengubah permission server. |
| `WorkspaceNavigation()` | Role, permission navigasi, mode mobile | Navigasi responsif | Membaca pathname aktif di client agar sorotan menu berubah tanpa memasang ulang shell dan state sidebar. |
| `WorkspaceSidebarPreference()` | Nilai awal sidebar dari cookie | Checkbox kontrol sidebar | Menyimpan pilihan kecil/besar selama satu tahun; shared layout mempertahankan kontrol dan state selama navigasi operasional. |
| `CatalogPage()` | URL search params | Boundary katalog | Segera merender `<Suspense>` dengan skeleton tanpa menunggu query katalog. |
| `CatalogContent()` | URL search params | Konten katalog dynamic | Memvalidasi `catalog:view`, membaca kategori/produk fresh, lalu mengganti skeleton melalui streaming; tidak mengubah data. |
| `CatalogFilters()` | Kategori, search, hak kelola | Form GET | Menyelaraskan pencarian/filter dengan URL agar dapat dibagikan dan dinavigasi. |
| `CategoryFormDialog()` | Kategori opsional | Dialog form | Membuat atau mengedit kategori dengan label, error, pending state, dan target sentuh aksesibel. |
| `ProductFormDialog()` | Kategori dan produk opsional | Dialog form | Membuat atau mengedit produk, termasuk selector kategori serta input harga Rupiah. |
| `CatalogStatusActionButton()` | Jenis entity dan snapshot item | Form action | Mengarsipkan atau memulihkan entity dengan versi `updatedAt` tersembunyi. |
| `ProductTableRow()`, `ProductCard()` | Product DTO dan hak kelola | Row desktop/card mobile | Menampilkan representasi produk sesuai viewport dan menyembunyikan kontrol mutation dari kasir. |
| `CategoryRailLink()` | Label, count, status aktif | Link filter | Menjadikan indeks kategori sebagai navigasi fungsional pada menu ledger. |
| `CatalogPagination()`, `CatalogPaginationNav()`, primitive `Pagination*()` | Halaman, total, search, pembentuk URL | Navigasi halaman responsif | Menampilkan nomor halaman di tablet/desktop, ringkasan ringkas di mobile, dan mempertahankan filter untuk katalog master maupun outlet dengan struktur shadcn. |
| `getCatalogPaginationItems()` | Halaman aktif dan total halaman | Nomor halaman serta elipsis | Membentuk jendela nomor halaman ringkas tanpa membuat kontrol melebar pada hasil yang panjang. |
| `catalogHref()` | Search saat ini dan perubahan | URL katalog | Membentuk query string canonical tanpa parameter default yang tidak perlu. |
| `CatalogLoading()` | Tidak ada | Skeleton konten | Menjadi fallback route dan fallback `<Suspense>` hanya di dalam layout katalog, sehingga sidebar tetap interaktif selama data menunggu. |
| `CatalogError()` | Error dan callback reset | Error boundary | Menyediakan pemulihan aman saat pembacaan katalog gagal. |
| `CatalogTextField()`, `CatalogActionFeedback()`, `toFieldErrors()` | Props field/action | Kontrol form | Menyatukan relasi label, pesan Zod, dan feedback action di dialog katalog. |
| `ProductImage()` | URL, nama, ukuran dan posisi fokus | Slot gambar atau monogram | Merender `next/image` pada kualitas 95 dengan `object-position` responsif, alt bermakna, dan fallback monogram. |
| `ProductImageManager()`, `ProductImagePositionEditor()` | DTO produk | Form upload/hapus dan editor fokus | Mengelola satu gambar master serta posisi crop melalui drag, touch, atau tombol panah dengan pending state dan feedback toast. |
| `compressProductImage()`, `findHighestQualityImage()`, `canvasToBlob()` | File di atas 3 MB | File dengan format asli maksimal 3 MB | Mempertahankan JPEG/PNG/WebP, resolusi hingga 4096px, mencari kualitas tertinggi untuk format lossy, dan baru mengecilkan dimensi bila masih diperlukan. |
| `getProductImageClientError()`, `formatImageSize()` | File atau byte | Pesan/label ukuran | Memberi validasi format dan feedback ukuran kompresi tanpa menjadi pengganti validasi server. |
| `CatalogEmptyState()` | Hak kelola dan kondisi katalog | Presentasi | Menampilkan arahan empty state sesuai role dan ketersediaan kategori. |
| `singleValue()` | Search param tunggal/array | String opsional | Membatasi nilai URL sebelum masuk ke schema Zod. |
| `runCatalogE2E()` | Environment test | Exit process | Membuat akun role sementara, menjalankan Playwright live, dan selalu membersihkan fixture. |
| `createTemporaryTestAccount()`, `cleanupCatalogFixture()`, `delay()` | Fixture E2E | `void` | Menangani setup idempoten, retry Neon singkat, dan cleanup data test. |
| `ThemeProvider()` | `children` | Provider client | Mengikuti preferensi sistem dan mempersistensi pilihan pengguna. |

## Utility dan primitive UI

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `cn()` | Daftar class/value kondisional | String class | Menggabungkan `clsx` dan `tailwind-merge`; tanpa side effect. |
| `Button()` | Props Base UI dan variant CVA | Tombol | Primitive tombol dengan `data-slot`, focus ring, variant, dan target sentuh utama 48px. |
| `Input()` | Props input native | Input Base UI | Primitive input dengan label eksternal, state invalid/disabled, dan focus ring. |
| `CurrencyInput()` | Nilai raw, nama field, opsi negatif | Input Rupiah dan hidden raw value | Memformat ribuan dengan titik saat mengetik tanpa floating point atau dependency tambahan. |
| `FieldSet()`, `FieldLegend()`, `FieldGroup()`, `Field()`, `FieldContent()`, `FieldLabel()`, `FieldTitle()`, `FieldDescription()`, `FieldSeparator()`, `FieldError()` | Props elemen masing-masing | Struktur form | Primitive shadcn untuk relasi label, deskripsi, error ARIA, orientasi, dan pengelompokan field. |
| `Card()`, `CardHeader()`, `CardFooter()`, `CardTitle()`, `CardAction()`, `CardDescription()`, `CardContent()` | Props div masing-masing | Struktur card | Primitive surface yang konsisten; tanpa side effect. |
| `Alert()`, `AlertTitle()`, `AlertDescription()`, `AlertAction()` | Props div dan variant | Pesan status | Primitive `role=alert` untuk status normal atau destruktif. |
| `Badge()` | Props badge dan variant | Badge | Label status ringkas dengan variant CVA dan `data-slot`. |
| `Label()` | Props Base UI label | Label | Primitive label form yang dapat dikaitkan dengan kontrol. |
| `Separator()` | Props separator | Separator | Garis pemisah visual/semantik. |
| `Skeleton()` | Props div | Placeholder | State loading non-interaktif. |
| `Spinner()` | Props SVG | Indikator loading | Indikator proses dengan label status; animasi mengikuti reduced-motion global. |
| `Dialog*` | Props Base UI dialog | Primitive dialog | Menjaga focus trap, overlay, close button, serta layout hampir fullscreen pada mobile. |
| `AlertDialog*` | Props Base UI alert dialog | Primitive konfirmasi | Menjaga focus trap dan konfirmasi eksplisit sebelum arsip outlet, reset kata sandi, atau nonaktifkan staf; tidak menjalankan mutation sebelum tombol konfirmasi ditekan. |
| `Select*` | Props Base UI select | Primitive select | Menyediakan pilihan kategori yang keyboard-accessible dan tersambung ke form. |
| `SearchableSelect()` | Nama field, opsi, nilai, dan state opsional | Combobox satu pilihan | Menampilkan input pencarian dengan panel selalu di bawah kontrol, memfilter label secara lokal, dan mengirim value terpilih melalui form; callback perubahan hanya berjalan bila diberikan. |
| `ToastProvider()` | Tidak ada | React Toastify container | Memasang satu region notifikasi sukses responsif di kanan-bawah, menghormati safe area, dan menutup toast otomatis setelah empat detik. |
| `useAutoCloseDialogAction()` | Server Action, initial state, dan flag penutupan | State/action form serta kontrol dialog | Menjalankan action, menampilkan toast sukses/error, lalu menutup dialog hanya pada hasil sukses bila diaktifkan. |
| `DropdownMenu*` | Props Base UI menu | Primitive menu | Menyediakan fondasi menu aksi terstruktur untuk pertumbuhan katalog. |
| `Table*` | Props elemen tabel | Primitive tabel | Menjaga struktur semantik daftar produk pada desktop/tablet landscape. |
| `Textarea()` | Props textarea native | Textarea | Input deskripsi dengan focus ring dan state invalid/disabled konsisten. |
