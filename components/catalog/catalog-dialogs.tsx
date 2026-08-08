"use client";

import { useActionState, useRef, useState } from "react";
import { Archive, Crosshair, Move, Pencil, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "react-toastify";

import {
  archiveCategoryAction,
  archiveProductAction,
  createCategoryAction,
  createProductAction,
  restoreCategoryAction,
  restoreProductAction,
  removeProductImageAction,
  saveProductImageAction,
  saveProductImagePositionAction,
  updateCategoryAction,
  updateProductAction,
} from "@/app/catalog/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAutoCloseDialogAction } from "@/components/ui/use-auto-close-dialog-action";
import type { CatalogCategoryItem, CatalogProductItem } from "@/lib/catalog/types";
import { initialCatalogActionState } from "@/lib/catalog/types";

type CategoryDialogProps = {
  category?: CatalogCategoryItem;
};

export function CategoryFormDialog({ category }: CategoryDialogProps) {
  const isEditing = Boolean(category);
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(
    isEditing ? updateCategoryAction : createCategoryAction,
    initialCatalogActionState,
  );

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button size={isEditing ? "icon" : "default"} variant={isEditing ? "ghost" : "outline"} />
        }
      >
        {isEditing ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        <span className={isEditing ? "sr-only" : undefined}>
          {isEditing ? `Edit kategori ${category?.name}` : "Kategori baru"}
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit kategori" : "Kategori baru"}</DialogTitle>
          <DialogDescription>
            Kategori membantu staf menemukan kelompok menu tanpa mengubah alur harga.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-5">
          {category && (
            <>
              <input name="id" type="hidden" value={category.id} />
              <input name="expectedUpdatedAt" type="hidden" value={category.updatedAt} />
            </>
          )}
          <FieldGroup>
            <CatalogTextField
              defaultValue={category?.name}
              errors={state.fieldErrors?.name}
              label="Nama kategori"
              maxLength={60}
              name="name"
              placeholder="Contoh: Kopi"
            />
            <Field data-invalid={Boolean(state.fieldErrors?.description)}>
              <FieldLabel htmlFor={`${category?.id ?? "new"}-category-description`}>Deskripsi (opsional)</FieldLabel>
              <Textarea
                aria-invalid={Boolean(state.fieldErrors?.description)}
                defaultValue={category?.description ?? ""}
                id={`${category?.id ?? "new"}-category-description`}
                maxLength={240}
                name="description"
                placeholder="Catatan singkat untuk pengelola menu"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.description)} />
            </Field>
            <CatalogTextField
              defaultValue={String(category?.displayOrder ?? 0)}
              errors={state.fieldErrors?.displayOrder}
              label="Urutan tampil"
              max={9999}
              min={0}
              name="displayOrder"
              type="number"
            />
          </FieldGroup>
          <CatalogActionFeedback state={state} />
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending && <Spinner />}
              {pending ? "Menyimpan…" : "Simpan kategori"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Manages the single master image for an existing product without closing the edit dialog. */
function ProductImageManager({ product }: { product: CatalogProductItem }) {
  const upload = useAutoCloseDialogAction(saveProductImageAction, initialCatalogActionState, false);
  const remove = useAutoCloseDialogAction(removeProductImageAction, initialCatalogActionState, false);
  const [imageError, setImageError] = useState("");
  const [compressing, setCompressing] = useState(false);
  return (
    <section aria-labelledby={`${product.id}-image-title`} className="grid gap-4 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:p-4">
      <ProductImage className="aspect-square w-20 rounded-lg" imageUrl={product.imageUrl} name={product.name} positionX={product.imagePositionX} positionY={product.imagePositionY} sizes="80px" />
      <div className="min-w-0">
        <h3 className="font-heading font-semibold" id={`${product.id}-image-title`}>Gambar produk</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">JPEG, PNG, atau WebP hingga 3 MB dikirim tanpa kompresi. File lebih besar dikompres otomatis. Hasil ditampilkan 1:1.</p>
        <form action={upload.action} className="mt-3 grid gap-2">
          <input name="productId" type="hidden" value={product.id} />
          <Field data-invalid={Boolean(imageError || upload.state.fieldErrors?.image)}>
            <FieldLabel htmlFor={`${product.id}-image-file`}>Pilih gambar</FieldLabel>
            <Input
              accept="image/jpeg,image/png,image/webp"
              aria-invalid={Boolean(imageError || upload.state.fieldErrors?.image)}
              disabled={upload.pending || compressing}
              id={`${product.id}-image-file`}
              name="image"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                const message = getProductImageClientError(file);
                setImageError(message);
                if (message || !file) {
                  if (message) toast.error(message);
                  return;
                }
                if (file.size <= productImageCompressionThreshold) return;

                setCompressing(true);
                try {
                  const compressed = await compressProductImage(file);
                  const transfer = new DataTransfer();
                  transfer.items.add(compressed);
                  input.files = transfer.files;
                  toast.info(`Gambar dikompres dari ${formatImageSize(file.size)} menjadi ${formatImageSize(compressed.size)}.`);
                } catch (error) {
                  console.error("Product image client compression failed", error);
                  const compressionError = "Gambar gagal dikompres. Pilih gambar lain atau kecilkan ukurannya.";
                  input.value = "";
                  setImageError(compressionError);
                  toast.error(compressionError);
                } finally {
                  setCompressing(false);
                }
              }}
              required
              type="file"
            />
            <FieldError errors={toFieldErrors(imageError ? [imageError] : upload.state.fieldErrors?.image)} />
          </Field>
          <Button className="w-full sm:w-fit" disabled={upload.pending || compressing || Boolean(imageError)} type="submit" variant="outline">
            {upload.pending || compressing ? <Spinner /> : <Upload aria-hidden="true" />}
            {compressing ? "Mengompres…" : upload.pending ? "Mengunggah…" : product.imageUrl ? "Ganti gambar" : "Unggah gambar"}
          </Button>
          <CatalogActionFeedback state={upload.state} />
        </form>
        {product.imageUrl && (
          <form action={remove.action} className="mt-2 grid gap-2">
            <input name="productId" type="hidden" value={product.id} />
            <Button className="w-full sm:w-fit" disabled={remove.pending} type="submit" variant="ghost">
              {remove.pending ? <Spinner /> : <Trash2 aria-hidden="true" />}
              {remove.pending ? "Menghapus…" : "Hapus gambar"}
            </Button>
            <CatalogActionFeedback state={remove.state} />
          </form>
        )}
      </div>
      {product.imageUrl ? (
        <ProductImagePositionEditor key={`${product.imageUrl}-${product.imagePositionX}-${product.imagePositionY}`} product={product} />
      ) : (
        <div className="grid gap-3 border-t pt-4 sm:col-span-2">
          <div><h4 className="font-heading text-sm font-semibold">Atur crop 1:1</h4><p className="mt-1 text-xs text-muted-foreground">Unggah gambar terlebih dahulu untuk mengaktifkan drag posisi.</p></div>
          <div className="mx-auto grid aspect-square w-full max-w-60 place-items-center rounded-xl border border-dashed bg-background text-center"><div><Crosshair aria-hidden="true" className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">Editor posisi muncul di sini</p></div></div>
        </div>
      )}
    </section>
  );
}

/** Provides a responsive focal-point editor with pointer, touch, and keyboard controls. */
function ProductImagePositionEditor({ product }: { product: CatalogProductItem }) {
  const save = useAutoCloseDialogAction(saveProductImagePositionAction, initialCatalogActionState, false);
  const [position, setPosition] = useState({ x: product.imagePositionX, y: product.imagePositionY });
  const dragStart = useRef<{ clientX: number; clientY: number; positionX: number; positionY: number } | null>(null);

  /** Moves the visible image from its drag origin while keeping the crop inside bounded percentages. */
  function moveImageFromPointer(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragStart.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: clampImagePosition(Math.round(dragStart.current.positionX - ((event.clientX - dragStart.current.clientX) / bounds.width) * 100)),
      y: clampImagePosition(Math.round(dragStart.current.positionY - ((event.clientY - dragStart.current.clientY) / bounds.height) * 100)),
    });
  }

  /** Moves the focal point with arrow keys as an accessible drag alternative. */
  function handlePositionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 10 : 1;
    const delta = {
      ArrowDown: { x: 0, y: -step },
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    setPosition((current) => ({
      x: clampImagePosition(current.x + delta.x),
      y: clampImagePosition(current.y + delta.y),
    }));
  }

  return (
    <form action={save.action} className="grid gap-3 border-t pt-4 sm:col-span-2">
      <div>
        <h4 className="font-heading text-sm font-semibold">Atur crop 1:1</h4>
        <p className="mt-1 text-xs leading-5 text-muted-foreground" id={`${product.id}-position-help`}>Tahan lalu geser foto di dalam frame, seperti mengatur foto profil. Gunakan tombol panah untuk penyesuaian halus.</p>
      </div>
      <button
        aria-describedby={`${product.id}-position-help`}
        aria-label={`Atur titik fokus gambar ${product.name}`}
        className="relative mx-auto block aspect-square w-full max-w-sm touch-none cursor-grab overflow-hidden rounded-xl border bg-accent/30 text-left shadow-inner focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none active:cursor-grabbing"
        onKeyDown={handlePositionKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragStart.current = { clientX: event.clientX, clientY: event.clientY, positionX: position.x, positionY: position.y };
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) moveImageFromPointer(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          dragStart.current = null;
        }}
        onPointerCancel={() => { dragStart.current = null; }}
        type="button"
      >
        <ProductImage className="absolute inset-0" imageUrl={product.imageUrl} name={product.name} positionX={position.x} positionY={position.y} sizes="(max-width: 639px) calc(100vw - 4rem), 24rem" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-1/2 flex min-h-9 -translate-x-1/2 items-center gap-2 rounded-full border bg-background/90 px-3 text-xs font-semibold shadow-sm backdrop-blur-sm"><Move className="size-4" />Geser foto</span>
      </button>
      <input name="productId" type="hidden" value={product.id} />
      <input name="positionX" type="hidden" value={position.x} />
      <input name="positionY" type="hidden" value={position.y} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span aria-live="polite" className="font-mono text-xs text-muted-foreground">Fokus {position.x}% · {position.y}%</span>
        <Button disabled={save.pending} type="submit" variant="outline">
          {save.pending && <Spinner />}
          {save.pending ? "Menyimpan…" : "Simpan posisi"}
        </Button>
      </div>
      <CatalogActionFeedback state={save.state} />
    </form>
  );
}

/** Clamps a focal-point percentage to the database-supported range. */
function clampImagePosition(value: number) {
  return Math.min(100, Math.max(0, value));
}

/** Returns an immediate user-facing error for unsupported or oversized image selections. */
function getProductImageClientError(file?: File) {
  if (!file) return "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Gunakan gambar JPEG, PNG, atau WebP.";
  return "";
}

const productImageCompressionThreshold = 3 * 1024 * 1024;

/** Compresses images above 3 MB at the highest quality that fits the server limit. */
async function compressProductImage(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const outputType = file.type;
    let scale = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas tidak tersedia.");

    for (let attempt = 0; attempt < 6; attempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await findHighestQualityImage(canvas, outputType);
      if (compressed) {
        return new File([compressed], file.name, { type: outputType, lastModified: Date.now() });
      }
      scale *= 0.82;
    }
    throw new Error("Hasil kompresi masih melebihi 3 MB.");
  } finally {
    bitmap.close();
  }
}

/** Finds the highest same-format quality that stays at or below 3 MB. */
async function findHighestQualityImage(canvas: HTMLCanvasElement, type: string) {
  if (type === "image/png") {
    const png = await canvasToBlob(canvas, type, 1);
    return png.size <= productImageCompressionThreshold ? png : null;
  }

  const maximumQuality = await canvasToBlob(canvas, type, 0.98);
  if (maximumQuality.size <= productImageCompressionThreshold) return maximumQuality;

  let minimum = 0.7;
  let maximum = 0.98;
  let best: Blob | null = null;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const quality = (minimum + maximum) / 2;
    const candidate = await canvasToBlob(canvas, type, quality);
    if (candidate.size <= productImageCompressionThreshold) {
      best = candidate;
      minimum = quality;
    } else {
      maximum = quality;
    }
  }
  return best;
}

/** Converts a canvas to one WebP blob at the requested quality. */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Kompresi gambar gagal.")), type, quality);
  });
}

/** Formats image bytes for concise compression feedback. */
function formatImageSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type ProductDialogProps = {
  categories: CatalogCategoryItem[];
  product?: CatalogProductItem;
  defaultCategoryId?: string;
};

export function ProductFormDialog({ categories, product, defaultCategoryId }: ProductDialogProps) {
  const isEditing = Boolean(product);
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(
    isEditing ? updateProductAction : createProductAction,
    initialCatalogActionState,
  );
  const activeCategories = categories.filter((category) => category.status === "ACTIVE");
  const selectedCategory = product?.categoryId ?? defaultCategoryId ?? activeCategories[0]?.id;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button disabled={activeCategories.length === 0} />}>
        {isEditing ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {isEditing ? "Edit produk" : "Produk baru"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit produk" : "Produk baru"}</DialogTitle>
          <DialogDescription>
            Harga adalah harga menu dasar dalam Rupiah, sebelum pajak, layanan, dan diskon.
          </DialogDescription>
        </DialogHeader>
        {product && <ProductImageManager product={product} />}
        <form action={action} className="grid gap-5">
          {product && (
            <>
              <input name="id" type="hidden" value={product.id} />
              <input name="expectedUpdatedAt" type="hidden" value={product.updatedAt} />
            </>
          )}
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.categoryId)}>
              <FieldLabel htmlFor={`${product?.id ?? "new"}-product-category`}>Kategori</FieldLabel>
              <SearchableSelect
                aria-invalid={Boolean(state.fieldErrors?.categoryId)}
                defaultValue={selectedCategory}
                id={`${product?.id ?? "new"}-product-category`}
                key={selectedCategory ?? "unselected"}
                name="categoryId"
                options={activeCategories.map((category) => ({ label: category.name, value: category.id }))}
                placeholder="Cari kategori"
                required
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.categoryId)} />
            </Field>
            <CatalogTextField
              defaultValue={product?.name}
              errors={state.fieldErrors?.name}
              label="Nama produk"
              maxLength={120}
              name="name"
              placeholder="Contoh: Es kopi susu"
            />
            <CatalogTextField
              autoCapitalize="characters"
              defaultValue={product?.sku ?? ""}
              errors={state.fieldErrors?.sku}
              label="SKU (opsional)"
              maxLength={40}
              name="sku"
              placeholder="KOPI-001"
            />
            <Field data-invalid={Boolean(state.fieldErrors?.description)}>
              <FieldLabel htmlFor={`${product?.id ?? "new"}-product-description`}>Deskripsi (opsional)</FieldLabel>
              <Textarea
                aria-invalid={Boolean(state.fieldErrors?.description)}
                defaultValue={product?.description ?? ""}
                id={`${product?.id ?? "new"}-product-description`}
                maxLength={280}
                name="description"
                placeholder="Informasi singkat untuk staf"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.description)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <CatalogMoneyField
                defaultValue={product?.basePrice.split(".")[0]}
                errors={state.fieldErrors?.basePrice}
                label="Harga dasar (Rp)"
                name="basePrice"
                placeholder="25.000"
              />
              <CatalogTextField
                defaultValue={String(product?.displayOrder ?? 0)}
                errors={state.fieldErrors?.displayOrder}
                label="Urutan tampil"
                max={9999}
                min={0}
                name="displayOrder"
                type="number"
              />
            </div>
          </FieldGroup>
          <CatalogActionFeedback state={state} />
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending && <Spinner />}
              {pending ? "Menyimpan…" : "Simpan produk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type StatusActionButtonProps = {
  kind: "category" | "product";
  item: { id: string; name: string; status: "ACTIVE" | "ARCHIVED"; updatedAt: string };
};

export function CatalogStatusActionButton({ kind, item }: StatusActionButtonProps) {
  const restore = item.status === "ARCHIVED";
  const selectedAction = kind === "category"
    ? restore ? restoreCategoryAction : archiveCategoryAction
    : restore ? restoreProductAction : archiveProductAction;
  const [state, action, pending] = useActionState(selectedAction, initialCatalogActionState);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input name="id" type="hidden" value={item.id} />
      <input name="expectedUpdatedAt" type="hidden" value={item.updatedAt} />
      <Button
        aria-label={`${restore ? "Pulihkan" : "Arsipkan"} ${item.name}`}
        disabled={pending}
        size="icon"
        type="submit"
        variant={restore ? "outline" : "ghost"}
      >
        {pending ? <Spinner /> : restore ? <RotateCcw aria-hidden="true" /> : <Archive aria-hidden="true" />}
      </Button>
      {state.status !== "idle" && state.status !== "success" && (
        <span className="max-w-52 text-right text-xs text-destructive" role="alert">{state.message}</span>
      )}
    </form>
  );
}

function CatalogTextField({
  errors,
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { errors?: string[]; label: string; name: string }) {
  const id = `catalog-${name}-${String(props.defaultValue ?? "new").replace(/\W/g, "-")}`;
  return (
    <Field data-invalid={Boolean(errors)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input aria-invalid={Boolean(errors)} id={id} name={name} {...props} />
      <FieldError errors={toFieldErrors(errors)} />
    </Field>
  );
}

function CatalogMoneyField({
  errors,
  label,
  name,
  ...props
}: React.ComponentProps<typeof CurrencyInput> & { errors?: string[]; label: string; name: string }) {
  const id = `catalog-${name}-${String(props.defaultValue ?? "new").replace(/\W/g, "-")}`;
  return (
    <Field data-invalid={Boolean(errors)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <CurrencyInput aria-invalid={Boolean(errors)} id={id} name={name} {...props} />
      <FieldError errors={toFieldErrors(errors)} />
    </Field>
  );
}

function CatalogActionFeedback({ state }: { state: typeof initialCatalogActionState }) {
  if (state.status === "idle" || state.status === "success") return null;
  return (
    <Alert variant={state.status === "error" || state.status === "conflict" ? "destructive" : "default"}>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function toFieldErrors(errors?: string[]) {
  return errors?.map((message) => ({ message }));
}
