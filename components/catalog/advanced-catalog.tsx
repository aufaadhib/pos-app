"use client";

import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus, RotateCcw, Settings2 } from "lucide-react";

import {
  changeAdvancedCatalogStatusAction,
  saveModifierGroupAction,
  saveModifierOptionAction,
  saveOutletProductOverrideAction,
  saveOutletVariantOverrideAction,
  saveProductModifierAction,
  saveVariantGroupAction,
  saveVariantOptionAction,
} from "@/app/catalog/advanced-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatRupiah } from "@/lib/catalog/normalization";
import type {
  CatalogActionState,
  ModifierGroupItem,
  ModifierOptionItem,
  OutletCatalogProductItem,
  ProductModifierItem,
  VariantGroupItem,
  VariantOptionItem,
} from "@/lib/catalog/types";
import { ProductImage } from "@/components/product-image";
import { initialCatalogActionState } from "@/lib/catalog/types";
import type { OutletItem } from "@/lib/outlets/types";

/** Navigates between the owner master catalog and accessible outlet catalogs. */
export function CatalogScopeSelect({ outlets, showMaster = true, value }: { outlets: OutletItem[]; showMaster?: boolean; value: string }) {
  const router = useRouter();
  return (
    <div className="w-full sm:w-72">
      <SearchableSelect
        aria-label="Cakupan katalog"
        onValueChange={(nextValue) => {
          router.push(nextValue === "master" ? "/catalog?scope=master" : `/catalog?scope=outlet&outletId=${encodeURIComponent(nextValue)}`);
        }}
        options={[
          ...(showMaster ? [{ label: "Katalog master", value: "master" }] : []),
          ...outlets.map((outlet) => ({ label: `${outlet.name} · ${outlet.code}`, value: outlet.id })),
        ]}
        placeholder="Cari cakupan katalog"
        value={value}
      />
    </div>
  );
}

/** Creates or edits one required variant group for a product through a compact dialog. */
export function VariantGroupDialog({ productId, group }: { productId: string; group?: VariantGroupItem }) {
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(saveVariantGroupAction, initialCatalogActionState);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size={group ? "icon" : "default"} variant={group ? "ghost" : "outline"} />}>
        {group ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        <span className={group ? "sr-only" : undefined}>{group ? `Edit grup ${group.name}` : "Grup varian"}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{group ? "Edit grup varian" : "Tambah grup varian"}</DialogTitle><DialogDescription>Setiap grup meminta satu pilihan, misalnya Ukuran atau Suhu.</DialogDescription></DialogHeader>
        <form action={action} className="grid gap-5">
          <input name="productId" type="hidden" value={productId} />
          {group && <><input name="id" type="hidden" value={group.id} /><input name="expectedUpdatedAt" type="hidden" value={group.updatedAt} /></>}
          <FieldGroup>
            <CatalogInput defaultValue={group?.name} errors={state.fieldErrors?.name} label="Nama grup" maxLength={60} name="name" placeholder="Ukuran" />
            <CatalogInput defaultValue={String(group?.displayOrder ?? 0)} errors={state.fieldErrors?.displayOrder} label="Urutan tampil" min={0} name="displayOrder" type="number" />
          </FieldGroup>
          <ActionFeedback state={state} />
          <DialogFooter><Button disabled={pending} type="submit">{pending && <Spinner />}{pending ? "Menyimpan…" : "Simpan grup"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Creates or edits one additive option inside a product variant group. */
export function VariantOptionDialog({ groupId, option }: { groupId: string; option?: VariantOptionItem }) {
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(saveVariantOptionAction, initialCatalogActionState);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size={option ? "icon" : "sm"} variant={option ? "ghost" : "outline"} />}>
        {option ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        <span className={option ? "sr-only" : undefined}>{option ? `Edit opsi ${option.name}` : "Tambah opsi"}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{option ? "Edit opsi varian" : "Tambah opsi varian"}</DialogTitle><DialogDescription>Harga opsi ditambahkan ke harga dasar produk.</DialogDescription></DialogHeader>
        <form action={action} className="grid gap-5">
          <input name="variantGroupId" type="hidden" value={groupId} />
          {option && <><input name="id" type="hidden" value={option.id} /><input name="expectedUpdatedAt" type="hidden" value={option.updatedAt} /></>}
          <FieldGroup>
            <CatalogInput defaultValue={option?.name} errors={state.fieldErrors?.name} label="Nama opsi" maxLength={60} name="name" placeholder="Large" />
            <div className="grid gap-5 sm:grid-cols-2">
              <CatalogInput defaultValue={option?.priceAdjustment.split(".")[0] ?? "0"} errors={state.fieldErrors?.priceAdjustment} inputMode="numeric" label="Tambahan harga (Rp)" name="priceAdjustment" />
              <CatalogInput defaultValue={String(option?.displayOrder ?? 0)} errors={state.fieldErrors?.displayOrder} label="Urutan" min={0} name="displayOrder" type="number" />
            </div>
          </FieldGroup>
          <ActionFeedback state={state} />
          <DialogFooter><Button disabled={pending} type="submit">{pending && <Spinner />}{pending ? "Menyimpan…" : "Simpan opsi"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Creates or edits a reusable modifier group in the master library. */
export function ModifierGroupDialog({ group }: { group?: ModifierGroupItem }) {
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(saveModifierGroupAction, initialCatalogActionState);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size={group ? "icon" : "default"} variant={group ? "ghost" : "default"} />}>
        {group ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        <span className={group ? "sr-only" : undefined}>{group ? `Edit ${group.name}` : "Modifier baru"}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{group ? "Edit grup modifier" : "Grup modifier baru"}</DialogTitle><DialogDescription>Grup dapat digunakan kembali pada banyak produk.</DialogDescription></DialogHeader>
        <form action={action} className="grid gap-5">
          {group && <><input name="id" type="hidden" value={group.id} /><input name="expectedUpdatedAt" type="hidden" value={group.updatedAt} /></>}
          <FieldGroup>
            <CatalogInput defaultValue={group?.name} errors={state.fieldErrors?.name} label="Nama grup" maxLength={60} name="name" placeholder="Topping" />
            <Field data-invalid={Boolean(state.fieldErrors?.description)}><FieldLabel htmlFor={`modifier-description-${group?.id ?? "new"}`}>Deskripsi (opsional)</FieldLabel><Textarea defaultValue={group?.description ?? ""} id={`modifier-description-${group?.id ?? "new"}`} maxLength={240} name="description" /><FieldError errors={toFieldErrors(state.fieldErrors?.description)} /></Field>
          </FieldGroup>
          <ActionFeedback state={state} />
          <DialogFooter><Button disabled={pending} type="submit">{pending && <Spinner />}{pending ? "Menyimpan…" : "Simpan modifier"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Creates or edits one priced option in a reusable modifier group. */
export function ModifierOptionDialog({ groupId, option }: { groupId: string; option?: ModifierOptionItem }) {
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(saveModifierOptionAction, initialCatalogActionState);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size={option ? "icon" : "sm"} variant={option ? "ghost" : "outline"} />}>
        {option ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        <span className={option ? "sr-only" : undefined}>{option ? `Edit ${option.name}` : "Tambah opsi"}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{option ? "Edit opsi modifier" : "Opsi modifier baru"}</DialogTitle><DialogDescription>Harga tambahan berlaku global untuk seluruh produk yang memakai grup ini.</DialogDescription></DialogHeader>
        <form action={action} className="grid gap-5">
          <input name="modifierGroupId" type="hidden" value={groupId} />
          {option && <><input name="id" type="hidden" value={option.id} /><input name="expectedUpdatedAt" type="hidden" value={option.updatedAt} /></>}
          <FieldGroup>
            <CatalogInput defaultValue={option?.name} errors={state.fieldErrors?.name} label="Nama opsi" maxLength={60} name="name" placeholder="Extra shot" />
            <div className="grid gap-5 sm:grid-cols-2">
              <CatalogInput defaultValue={option?.priceAdjustment.split(".")[0] ?? "0"} errors={state.fieldErrors?.priceAdjustment} inputMode="numeric" label="Tambahan harga (Rp)" name="priceAdjustment" />
              <CatalogInput defaultValue={String(option?.displayOrder ?? 0)} errors={state.fieldErrors?.displayOrder} label="Urutan" min={0} name="displayOrder" type="number" />
            </div>
          </FieldGroup>
          <ActionFeedback state={state} />
          <DialogFooter><Button disabled={pending} type="submit">{pending && <Spinner />}{pending ? "Menyimpan…" : "Simpan opsi"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Attaches or edits a modifier group's min/max selection rules on one product. */
export function ProductModifierDialog({ productId, groups, relation }: { productId: string; groups: ModifierGroupItem[]; relation?: ProductModifierItem }) {
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(saveProductModifierAction, initialCatalogActionState);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size={relation ? "icon" : "default"} variant={relation ? "ghost" : "outline"} />}>
        {relation ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        <span className={relation ? "sr-only" : undefined}>{relation ? `Edit aturan ${relation.modifierGroupName}` : "Pasang modifier"}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{relation ? "Edit aturan modifier" : "Pasang grup modifier"}</DialogTitle><DialogDescription>Minimum 0 berarti opsional; maksimum 1 menjadi single-select.</DialogDescription></DialogHeader>
        <form action={action} className="grid gap-5">
          <input name="productId" type="hidden" value={productId} />
          {relation?.updatedAt && <input name="expectedUpdatedAt" type="hidden" value={relation.updatedAt} />}
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.modifierGroupId)}><FieldLabel htmlFor={`product-modifier-${productId}`}>Grup modifier</FieldLabel>{relation && <input name="modifierGroupId" type="hidden" value={relation.modifierGroupId} />}<SearchableSelect defaultValue={relation?.modifierGroupId} disabled={Boolean(relation)} id={`product-modifier-${productId}`} name={relation ? undefined : "modifierGroupId"} options={groups.filter((group) => group.status === "ACTIVE").map((group) => ({ label: group.name, value: group.id }))} placeholder="Cari modifier" required /><FieldError errors={toFieldErrors(state.fieldErrors?.modifierGroupId)} /></Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <CatalogInput defaultValue={String(relation?.minSelections ?? 0)} errors={state.fieldErrors?.minSelections} label="Minimum" min={0} name="minSelections" type="number" />
              <CatalogInput defaultValue={String(relation?.maxSelections ?? 1)} errors={state.fieldErrors?.maxSelections} label="Maksimum" min={1} name="maxSelections" type="number" />
              <CatalogInput defaultValue={String(relation?.displayOrder ?? 0)} errors={state.fieldErrors?.displayOrder} label="Urutan" min={0} name="displayOrder" type="number" />
            </div>
          </FieldGroup>
          <ActionFeedback state={state} />
          <DialogFooter><Button disabled={pending || groups.length === 0} type="submit">{pending && <Spinner />}{pending ? "Menyimpan…" : "Simpan aturan"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Archives or restores an advanced catalog entity with explicit destructive confirmation. */
export function AdvancedCatalogStatusAction({ entityType, id, parentId, label, status, updatedAt }: { entityType: "VARIANT_GROUP" | "VARIANT_OPTION" | "MODIFIER_GROUP" | "MODIFIER_OPTION" | "PRODUCT_MODIFIER"; id: string; parentId?: string; label: string; status: "ACTIVE" | "ARCHIVED"; updatedAt: string }) {
  const restoring = status === "ARCHIVED";
  const { state, action, pending } = useAutoCloseDialogAction(changeAdvancedCatalogStatusAction, initialCatalogActionState, false);
  const fields = <><input name="entityType" type="hidden" value={entityType} /><input name="id" type="hidden" value={id} />{parentId && <input name="parentId" type="hidden" value={parentId} />}<input name="status" type="hidden" value={restoring ? "ACTIVE" : "ARCHIVED"} /><input name="expectedUpdatedAt" type="hidden" value={updatedAt} /></>;
  const error = state.status === "error" || state.status === "conflict" ? <span className="max-w-48 text-right text-xs text-destructive" role="alert">{state.message}</span> : null;
  if (restoring) return <div className="grid justify-items-end gap-1"><form action={action}>{fields}<Button aria-label={`Pulihkan ${label}`} disabled={pending} size="icon" type="submit" variant="outline">{pending ? <Spinner /> : <RotateCcw aria-hidden="true" />}</Button></form>{error}</div>;
  return (
    <div className="grid justify-items-end gap-1"><AlertDialog>
      <AlertDialogTrigger render={<Button aria-label={`Arsipkan ${label}`} disabled={pending} size="icon" type="button" variant="ghost" />}><Archive aria-hidden="true" /></AlertDialogTrigger>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arsipkan {label}?</AlertDialogTitle><AlertDialogDescription>Data tidak dihapus dan dapat dipulihkan kembali.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><form action={action}>{fields}<AlertDialogAction disabled={pending} type="submit" variant="destructive">Arsipkan</AlertDialogAction></form></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>{error}</div>
  );
}

/** Renders one responsive outlet product editor with inherited base and variant prices. */
export function OutletCatalogProductCard({ canManage, outletId, product }: { canManage: boolean; outletId: string; product: OutletCatalogProductItem }) {
  return (
    <Card className={product.isAvailable ? "border shadow-none" : "border border-dashed opacity-70 shadow-none"}>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><ProductImage className="size-12 rounded-lg" imageUrl={product.imageUrl} name={product.name} positionX={product.imagePositionX} positionY={product.imagePositionY} sizes="48px" /><div><div className="flex flex-wrap items-center gap-2"><CardTitle>{product.name}</CardTitle><Badge variant={product.isAvailable ? "secondary" : "outline"}>{product.isAvailable ? "Tersedia" : "Tidak tersedia"}</Badge>{product.hasPriceOverride && <Badge variant="outline">Harga outlet</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{product.categoryName} · {product.sku ?? "Tanpa SKU"}</p></div></div>
        <p className="font-mono font-semibold">{formatRupiah(product.effectiveBasePrice)}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {canManage && <OutletProductOverrideForm outletId={outletId} product={product} />}
        {product.variantGroups.length > 0 && (
          <details className="rounded-xl border bg-muted/20 p-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold"><span className="flex items-center gap-2"><Settings2 aria-hidden="true" className="size-4" />Varian outlet</span><span className="text-xs text-muted-foreground">{product.variantGroups.length} grup</span></summary>
            <div className="mt-3 grid gap-4">
              {product.variantGroups.map((group) => <section className="grid gap-2" key={group.id}><h3 className="text-sm font-semibold">{group.name}</h3>{group.options.map((option) => canManage ? <OutletVariantOverrideForm key={option.id} option={option} outletId={outletId} /> : <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm" key={option.id}><span>{option.name}</span><span className="font-mono">+{formatRupiah(option.effectivePriceAdjustment)}</span></div>)}</section>)}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/** Submits one product-level availability and price override without closing the surrounding card. */
function OutletProductOverrideForm({ outletId, product }: { outletId: string; product: OutletCatalogProductItem }) {
  const { state, action, pending } = useAutoCloseDialogAction(saveOutletProductOverrideAction, initialCatalogActionState, false);
  return <form action={action} className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[minmax(9rem,.7fr)_minmax(10rem,1fr)_auto] sm:items-end"><input name="outletId" type="hidden" value={outletId} /><input name="productId" type="hidden" value={product.id} />{product.overrideUpdatedAt && <input name="expectedUpdatedAt" type="hidden" value={product.overrideUpdatedAt} />}<Field><FieldLabel htmlFor={`availability-${outletId}-${product.id}`}>Ketersediaan</FieldLabel><SearchableSelect defaultValue={String(product.isAvailable)} id={`availability-${outletId}-${product.id}`} name="isAvailable" options={[{ label: "Tersedia", value: "true" }, { label: "Tidak tersedia", value: "false" }]} placeholder="Pilih status" /></Field><CatalogInput defaultValue={product.hasPriceOverride ? product.effectiveBasePrice.split(".")[0] : ""} errors={state.fieldErrors?.priceOverride} inputMode="numeric" label={`Harga override · master ${formatRupiah(product.basePrice)}`} name="priceOverride" placeholder="Kosong = harga master" /><Button disabled={pending} type="submit">{pending && <Spinner />}{pending ? "Menyimpan…" : "Simpan"}</Button>{state.status === "error" || state.status === "conflict" ? <p className="text-sm text-destructive sm:col-span-3" role="alert">{state.message}</p> : null}</form>;
}

/** Submits one variant option override while preserving inherited master defaults. */
function OutletVariantOverrideForm({ outletId, option }: { outletId: string; option: OutletCatalogProductItem["variantGroups"][number]["options"][number] }) {
  const { state, action, pending } = useAutoCloseDialogAction(saveOutletVariantOverrideAction, initialCatalogActionState, false);
  return <form action={action} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[minmax(8rem,.7fr)_minmax(10rem,1fr)_auto] sm:items-end"><input name="outletId" type="hidden" value={outletId} /><input name="variantOptionId" type="hidden" value={option.id} />{option.overrideUpdatedAt && <input name="expectedUpdatedAt" type="hidden" value={option.overrideUpdatedAt} />}<Field><FieldLabel htmlFor={`variant-availability-${outletId}-${option.id}`}>{option.name}</FieldLabel><SearchableSelect defaultValue={String(option.isAvailable)} id={`variant-availability-${outletId}-${option.id}`} name="isAvailable" options={[{ label: "Tersedia", value: "true" }, { label: "Tidak tersedia", value: "false" }]} placeholder="Pilih status" /></Field><CatalogInput defaultValue={option.hasPriceOverride ? option.effectivePriceAdjustment.split(".")[0] : ""} errors={state.fieldErrors?.priceAdjustmentOverride} inputMode="numeric" label={`Tambahan · master ${formatRupiah(option.priceAdjustment)}`} name="priceAdjustmentOverride" placeholder="Kosong = master" /><Button disabled={pending} size="sm" type="submit">{pending ? <Spinner /> : "Simpan"}</Button>{state.status === "error" || state.status === "conflict" ? <p className="text-xs text-destructive sm:col-span-3" role="alert">{state.message}</p> : null}</form>;
}

/** Connects an advanced-catalog input to its visible label and server field errors. */
function CatalogInput({ errors, label, name, ...props }: React.ComponentProps<typeof Input> & { errors?: string[]; label: string; name: string }) {
  const id = `advanced-${name}-${String(props.defaultValue ?? "new").replace(/\W/g, "-")}`;
  return <Field data-invalid={Boolean(errors)}><FieldLabel htmlFor={id}>{label}</FieldLabel><Input aria-invalid={Boolean(errors)} id={id} name={name} {...props} /><FieldError errors={toFieldErrors(errors)} /></Field>;
}

/** Renders non-success action feedback inline so users retain a recovery path. */
function ActionFeedback({ state }: { state: CatalogActionState }) {
  if (state.status === "idle" || state.status === "success") return null;
  return <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>;
}

/** Adapts serialized Zod messages to the shadcn FieldError contract. */
function toFieldErrors(errors?: string[]) { return errors?.map((message) => ({ message })); }
