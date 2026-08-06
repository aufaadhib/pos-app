# Function Reference

Dokumen ini mencatat function dan component function yang ditambahkan pada milestone fondasi Glutong POS. Nama kode menggunakan bahasa Inggris; penjelasan ditulis dalam Bahasa Indonesia.

## Authentication, authorization, dan database

| Function | Input | Output | Tujuan dan side effect |
| --- | --- | --- | --- |
| `createAuth()` | Opsi `allowSignUp` dan `defaultRole` | Instance Better Auth | Membentuk konfigurasi runtime atau seed. Instance seed dapat mengaktifkan sign-up secara lokal; endpoint runtime tetap menonaktifkannya. |
| `getCurrentSession()` | Tidak ada; membaca header request aktif | Session atau `null` | Membaca session server-side. Dideduplikasi dengan React `cache()` hanya selama satu render/request. |
| `requireSession()` | Tidak ada | Session valid | Mengalihkan pengguna anonim ke `/sign-in`. |
| `requirePermission()` | Satu object permission terpusat | Session valid | Memeriksa permission melalui Better Auth menggunakan user ID terbaru; mengalihkan akses gagal ke workspace. |
| `seedInitialOwner()` | Environment bootstrap | Data user owner | Membuat owner hanya pada database kosong, no-op untuk owner identik, dan abort untuk akun yang bertentangan. Menulis user/account dan password hash melalui Better Auth. |
| `createPrismaClient()` | `DATABASE_URL` dari environment | Prisma client dengan Neon adapter | Membentuk koneksi pooled untuk runtime; instance digunakan ulang saat development. |
| `parseServerEnvironment()` | Object environment | Environment tervalidasi | Memvalidasi URL database, base URL auth, dan secret. Melempar error tanpa membocorkan nilai rahasia. |
| `parseOwnerEnvironment()` | Object environment | Environment owner tervalidasi | Menambahkan validasi nama/email serta password bootstrap minimum 12 karakter. |
| `getServerEnvironment()` | Tidak ada | Environment server tervalidasi | Membaca `process.env` hanya dari modul berpagar `server-only`. |
| `isAppRole()` | String role | Type predicate | Menentukan apakah nilai merupakan `owner`, `manager`, atau `cashier`. |
| `roleHasPermission()` | Role dan permission | Boolean | Mengevaluasi matrix RBAC yang sama dengan Better Auth untuk kebutuhan presentasi server. |

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
| `executeCatalogAction()` | Schema, FormData, mutation, pesan | `CatalogActionState` | Memvalidasi `catalog:manage`, input Zod, menjalankan mutation, lalu memanggil `revalidatePath` hanya setelah commit. |
| Action kategori dan produk | State dan FormData | State serializable | Delapan Server Action create/update/archive/restore; setiap pemanggilan mengulang autentikasi dan authorization. |
| `changeProductStatus()`, `updateCategoryStatus()` | Target, actor, status | Entity terbaru | Helper internal untuk perubahan status optimistic beserta timestamp arsip. |
| `requireActiveCategory()`, `findCategory()`, `findProduct()` | Transaction client dan ID | Record database | Membaca ulang sumber tepercaya di dalam transaction dan melempar domain error bila tidak sah. |
| `runCatalogMutation()` | Callback transaction | Hasil callback | Menjalankan seluruh mutation dalam Prisma transaction dan menerjemahkan konflik unique menjadi domain error. |
| `writeAudit()`, `writeChangeAudits()` | Snapshot, actor, action | `void` | Menulis audit dalam transaction yang sama; memisahkan perubahan harga dan urutan. |
| `categorySnapshot()`, `productSnapshot()`, `getChangedFields()` | Record sebelum/sesudah | JSON dan daftar field | Menyerialisasi Decimal/Date secara aman serta menentukan jenis audit yang diperlukan. |
| `serializeCatalogProduct()` | Record Prisma terpilih | DTO produk | Mengubah Decimal dan Date menjadi string sebelum data melewati batas Server Component. |

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
| `RootLayout()` | `children` | Dokumen HTML | Memasang metadata, font, Bahasa Indonesia, dan theme provider. |
| `HomePage()` | Tidak ada | Redirect | Membaca session dan mengarahkan ke sign-in atau workspace. |
| `SignInPage()` | Tidak ada | Halaman login | Merender brand rail statis dan form login client-side. |
| `WorkspacePage()` | Search params | Workspace terlindungi | Memvalidasi `workspace:view`, menampilkan identitas/role, dan waktu Asia/Jakarta. |
| `DesignSystemPage()` | Tidak ada | Showcase terlindungi | Memvalidasi `designSystem:view` sebelum merender referensi token dan komponen. |
| `proxy()` | `NextRequest` | `NextResponse` | Melakukan redirect optimistis dari keberadaan cookie saja; tidak menjadi kontrol authorization. |
| `BrandMark()` | Opsi inverse/compact/class | Wordmark | Merender identitas code-native tanpa asset gambar eksternal. |
| `ServiceTicketRail()` | Tidak ada | Ordered list | Menjelaskan urutan Masuk → Periksa → Melayani khusus layar login. |
| `WorkspaceHeader()` | Flag akses design system | Header | Menyusun navigasi aman, pemilih tema, dan logout. |
| `CatalogPage()` | URL search params | Halaman katalog dynamic | Memvalidasi `catalog:view`, memuat ledger sesuai role, dan menyusun UI responsif. |
| `CatalogFilters()` | Kategori, search, hak kelola | Form GET | Menyelaraskan pencarian/filter dengan URL agar dapat dibagikan dan dinavigasi. |
| `CategoryFormDialog()` | Kategori opsional | Dialog form | Membuat atau mengedit kategori dengan label, error, pending state, dan target sentuh aksesibel. |
| `ProductFormDialog()` | Kategori dan produk opsional | Dialog form | Membuat atau mengedit produk, termasuk selector kategori serta input harga Rupiah. |
| `CatalogStatusActionButton()` | Jenis entity dan snapshot item | Form action | Mengarsipkan atau memulihkan entity dengan versi `updatedAt` tersembunyi. |
| `ProductTableRow()`, `ProductCard()` | Product DTO dan hak kelola | Row desktop/card mobile | Menampilkan representasi produk sesuai viewport dan menyembunyikan kontrol mutation dari kasir. |
| `CategoryRailLink()` | Label, count, status aktif | Link filter | Menjadikan indeks kategori sebagai navigasi fungsional pada menu ledger. |
| `CatalogPagination()` | Halaman, total, search | Navigasi halaman | Mempertahankan query/filter saat berpindah halaman. |
| `catalogHref()` | Search saat ini dan perubahan | URL katalog | Membentuk query string canonical tanpa parameter default yang tidak perlu. |
| `CatalogLoading()` | Tidak ada | Skeleton route | Memberi state loading responsif selama Server Component menunggu data. |
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
| `Select*` | Props Base UI select | Primitive select | Menyediakan pilihan kategori yang keyboard-accessible dan tersambung ke form. |
| `DropdownMenu*` | Props Base UI menu | Primitive menu | Menyediakan fondasi menu aksi terstruktur untuk pertumbuhan katalog. |
| `Table*` | Props elemen tabel | Primitive tabel | Menjaga struktur semantik daftar produk pada desktop/tablet landscape. |
| `Textarea()` | Props textarea native | Textarea | Input deskripsi dengan focus ring dan state invalid/disabled konsisten. |
