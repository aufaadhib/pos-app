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
| `createPrismaClient()` | `DATABASE_URL` dari environment | Prisma client dengan Neon adapter | Membentuk koneksi pooled untuk runtime; instance digunakan ulang saat development. |
| `parseServerEnvironment()` | Object environment | Environment tervalidasi | Memvalidasi URL database, base URL auth, dan secret. Melempar error tanpa membocorkan nilai rahasia. |
| `parseOwnerEnvironment()` | Object environment | Environment owner tervalidasi | Menambahkan validasi nama/email serta password bootstrap minimum 12 karakter. |
| `getServerEnvironment()` | Tidak ada | Environment server tervalidasi | Membaca `process.env` hanya dari modul berpagar `server-only`. |
| `isAppRole()` | String role | Type predicate | Menentukan apakah nilai merupakan `owner`, `manager`, atau `cashier`. |
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
| `assertStaffRoleAllowed()` | Role actor dan target | `void` atau error | Mencegah manager membuat manager dan mencegah kasir melakukan pengelolaan. |
| `assertOutletAssignmentCount()` | Role staf dan outlet IDs | `void` atau error | Mewajibkan satu outlet untuk kasir dan minimal satu untuk manager. |
| `generateTemporaryPassword()` | Panjang opsional | Password acak | Membuat password minimum 12 karakter dengan uppercase, lowercase, angka, simbol, dan tanpa karakter ambigu. |
| `getStaff()` | Filter, page, actor | DTO halaman staf | Membaca staf sesuai cakupan role; manager hanya melihat kasir yang berbagi outlet. |
| `getManageableOutlets()` | User ID dan role | Opsi outlet | Membatasi pilihan penugasan ke outlet aktif yang boleh dikelola actor. |
| `createStaff()` | Data staf dan actor | User dan password sementara | Meng-hash via Better Auth lalu membuat user, account, assignments, dan audit dalam satu transaction. |
| `updateStaff()` | Data, versi, actor | User terbaru | Mengubah nama/role/penugasan secara optimistic dan mengaudit assignment yang berubah. |
| `deactivateStaff()`, `reactivateStaff()` | Target dan actor | User terbaru | Mengubah status tanpa delete; deaktivasi mencabut seluruh session. |
| `resetStaffPassword()` | Target dan actor | User serta password sementara | Mengganti hash, menandai wajib ganti password, mencabut session, dan mengaudit tanpa menyimpan plaintext. |
| `changeOwnPassword()` | Password lama/baru, session, actor | `void` | Memverifikasi password, mengganti hash, membersihkan kewajiban, dan mencabut session lain secara atomic. |
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
| `getProductMonogram()` | Nama produk | Inisial 1–2 huruf | Membentuk placeholder produk code-native; tanpa gambar eksternal. |
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
| `CatalogScopeSelect()` | Outlet dan scope | Selector client | Berpindah antara master dan outlet melalui URL tanpa menyimpan state tersembunyi. |
| `ProductOptionsPage()` | Product ID | Halaman editor | Menyusun editor varian serta modifier owner-only secara responsif. |
| `ModifierLibraryPage()` | Tidak ada | Halaman pustaka | Menyusun pengelolaan modifier reusable khusus owner. |
| `OutletCatalogProductCard()` | Produk efektif dan hak edit | Card responsif | Menampilkan harga efektif serta form override produk/varian untuk outlet. |

## Transaksi POS

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `calculateSaleTotals()` | Subtotal Decimal, tarif layanan/pajak, flag harga inklusif | Snapshot total Decimal | Menghitung layanan, pajak, dan total dengan pembulatan half-up ke Rupiah tanpa floating point. |
| `getPosMenu()` | Outlet, user, role | `PosMenu` atau `null` | Membaca maksimal 300 produk aktif beserta harga override, varian, dan modifier yang tersedia pada outlet. |
| `getSalesPage()` | Outlet dan halaman | Halaman transaksi | Membaca 20 transaksi terbaru per halaman tanpa cache persisten. |
| `getSaleDetail()` | Sale ID dan outlet aktif | Detail struk atau `null` | Membatasi detail struk ke outlet aktif dan mengubah Decimal/timestamp menjadi DTO serializable. |
| `createSale()` | Checkout tervalidasi dan actor | Hasil checkout | Menjalankan validasi harga fresh, nomor struk, sale, item, pembayaran, dan audit dalam transaction serializable; checkout token membuat retry idempoten. |
| `resolveCheckoutItems()` | Prisma transaction dan cart | Snapshot item | Memvalidasi status produk, override, satu varian per grup, min/max modifier, serta harga yang dilihat kasir. |
| `resolvePayment()` | Checkout dan total | Data pembayaran | Memastikan uang tunai cukup dan menghitung kembalian; non-tunai menyimpan referensi opsional. |
| `getBusinessDate()` | Zona waktu outlet | Tanggal bisnis dan token struk | Mengubah waktu saat ini menjadi tanggal operasional outlet tanpa menyimpan waktu lokal sebagai UTC palsu. |
| `findIdempotentSale()`, `serializeSaleResult()` | Token/record sale | Hasil action | Mengembalikan transaksi retry milik actor yang sama dan menolak token milik actor lain. |
| `checkoutSaleAction()` | Payload Client Component | `CheckoutActionState` | Memvalidasi Zod, session, permission `pos:operate`, menjalankan service, lalu merevalidasi riwayat. |
| `PosRegister()` | Menu outlet | Register interaktif | Mengelola pencarian, filter kategori, cart lokal, konfigurasi item, dan pembukaan checkout. |
| `ProductConfigurator()` | Produk dan callback cart | Dialog pilihan | Mengumpulkan satu pilihan per grup varian, modifier sesuai batas, jumlah, dan catatan item. |
| `CartPanel()` | Cart, total preview, callback | Ticket rail | Menampilkan item, kontrol jumlah/hapus, pajak/layanan, dan CTA pembayaran pada desktop/mobile. |
| `CheckoutDialog()` | Cart, menu, total, state dialog | Dialog pembayaran | Mengumpulkan jenis order, meja, metode, tunai/referensi, memanggil action, dan menampilkan toast. |
| `parseMoneyToMinor()`, `minorToMoney()`, `formatMinor()` | String atau integer minor unit | Bentuk uang lain | Menjaga kalkulasi preview sebagai integer minor unit dan memakai `Intl` hanya untuk tampilan. |
| `calculateClientTotals()`, `parseRate()`, `roundDivide()`, `maxMinor()` | Minor unit dan tarif | Preview checkout | Menyamakan urutan serta pembulatan preview client dengan server tanpa menjadikannya sumber kebenaran. |
| `formatRate()`, `productMonogram()` | Rate atau nama | Label UI | Membuat label persentase dan marker dua huruf tanpa asset gambar. |
| `PosLayout()`, `TransactionsLayout()` | Child route | Shell workspace | Mempertahankan sidebar/app bar/bottom navigation saat konten POS melakukan loading. |
| `PosPage()`, `TransactionsPage()`, `SaleDetailPage()` | Session, outlet, route/search params | Halaman dynamic | Memeriksa permission dan outlet aktif dekat sumber data sebelum merender register atau struk. |
| `PosLoading()`, `TransactionsLoading()` | Tidak ada | Skeleton konten | Menampilkan loading hanya pada bagian yang mengambil data sehingga navigasi tetap interaktif. |
| `formatSaleDate()`, `paymentLabel()` | Timestamp/metode | Label transaksi | Menampilkan waktu dalam zona outlet dan nama metode dalam Bahasa Indonesia. |

## Interaksi pengguna

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `LoginForm()` | Tidak ada | Form login interaktif | Mengelola validasi, pending state, pesan error generik, dan navigasi setelah login. |
| `handleSubmit()` | Submit event form | Promise | Memvalidasi email/password, memanggil Better Auth, lalu menuju workspace; tidak membedakan email yang terdaftar dan tidak. |
| `handlePasswordVisibility()` | Tidak ada | `void` | Mengganti input kata sandi antara tersembunyi dan terlihat. |
| `ThemeToggle()` | `className` opsional | Pemilih tema | Menampilkan pilihan terang/sistem/gelap dan menyimpan pilihan melalui `next-themes`. |
| `handleThemeChange()` | Nama tema | `void` | Memperbarui dan menyimpan tema pengguna. |
| `subscribeToHydration()` | Tidak ada | Unsubscribe function | Memberi `useSyncExternalStore` snapshot hydration tanpa effect/setState tambahan. |
| `SignOutButton()` | Tidak ada | Tombol keluar | Menampilkan pending state selama logout. |
| `handleSignOut()` | Tidak ada | Promise | Menghapus session lewat Better Auth lalu mengganti route ke `/sign-in`. |

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
| `WorkspaceHeader()` | Role, permission navigasi, outlet aktif, route aktif | Shell navigasi responsif | Menyusun sidebar desktop/tablet landscape, app bar serta bottom navigation mobile, menampilkan label role aktual, pemilih outlet, tema, dan logout tanpa mengubah permission server. |
| `CatalogLayout()` | Child route katalog | Shell katalog terlindungi | Membaca session fresh, menentukan navigasi sesuai role, dan mempertahankan `WorkspaceHeader` saat konten katalog melakukan streaming. |
| `CatalogPage()` | URL search params | Boundary katalog | Segera merender `<Suspense>` dengan skeleton tanpa menunggu query katalog. |
| `CatalogContent()` | URL search params | Konten katalog dynamic | Memvalidasi `catalog:view`, membaca kategori/produk fresh, lalu mengganti skeleton melalui streaming; tidak mengubah data. |
| `CatalogFilters()` | Kategori, search, hak kelola | Form GET | Menyelaraskan pencarian/filter dengan URL agar dapat dibagikan dan dinavigasi. |
| `CategoryFormDialog()` | Kategori opsional | Dialog form | Membuat atau mengedit kategori dengan label, error, pending state, dan target sentuh aksesibel. |
| `ProductFormDialog()` | Kategori dan produk opsional | Dialog form | Membuat atau mengedit produk, termasuk selector kategori serta input harga Rupiah. |
| `CatalogStatusActionButton()` | Jenis entity dan snapshot item | Form action | Mengarsipkan atau memulihkan entity dengan versi `updatedAt` tersembunyi. |
| `ProductTableRow()`, `ProductCard()` | Product DTO dan hak kelola | Row desktop/card mobile | Menampilkan representasi produk sesuai viewport dan menyembunyikan kontrol mutation dari kasir. |
| `CategoryRailLink()` | Label, count, status aktif | Link filter | Menjadikan indeks kategori sebagai navigasi fungsional pada menu ledger. |
| `CatalogPagination()` | Halaman, total, search | Navigasi halaman | Mempertahankan query/filter saat berpindah halaman. |
| `catalogHref()` | Search saat ini dan perubahan | URL katalog | Membentuk query string canonical tanpa parameter default yang tidak perlu. |
| `CatalogLoading()` | Tidak ada | Skeleton konten | Menjadi fallback route dan fallback `<Suspense>` hanya di dalam layout katalog, sehingga sidebar tetap interaktif selama data menunggu. |
| `CatalogError()` | Error dan callback reset | Error boundary | Menyediakan pemulihan aman saat pembacaan katalog gagal. |
| `CatalogTextField()`, `CatalogActionFeedback()`, `toFieldErrors()` | Props field/action | Kontrol form | Menyatukan relasi label, pesan Zod, dan feedback action di dialog katalog. |
| `ProductMonogram()`, `CatalogEmptyState()` | Nama/status katalog | Presentasi | Menampilkan placeholder code-native dan arahan empty state sesuai role. |
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
| `useAutoCloseDialogAction()` | Server Action, initial state, dan flag penutupan | State/action form serta kontrol dialog | Menjalankan action, memanggil `toast.success()` pada hasil sukses, lalu menutup dialog bila diaktifkan; error tetap mempertahankan dialog dan pembuatan staf dapat menonaktifkan auto-close untuk menampilkan kredensial. |
| `DropdownMenu*` | Props Base UI menu | Primitive menu | Menyediakan fondasi menu aksi terstruktur untuk pertumbuhan katalog. |
| `Table*` | Props elemen tabel | Primitive tabel | Menjaga struktur semantik daftar produk pada desktop/tablet landscape. |
| `Textarea()` | Props textarea native | Textarea | Input deskripsi dengan focus ring dan state invalid/disabled konsisten. |
