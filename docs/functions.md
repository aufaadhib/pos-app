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
