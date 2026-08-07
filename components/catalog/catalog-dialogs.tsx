"use client";

import { useActionState } from "react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";

import {
  archiveCategoryAction,
  archiveProductAction,
  createCategoryAction,
  createProductAction,
  restoreCategoryAction,
  restoreProductAction,
  updateCategoryAction,
  updateProductAction,
} from "@/app/catalog/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
              <CatalogTextField
                defaultValue={product?.basePrice.split(".")[0]}
                errors={state.fieldErrors?.basePrice}
                inputMode="numeric"
                label="Harga dasar (Rp)"
                name="basePrice"
                placeholder="25000"
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
