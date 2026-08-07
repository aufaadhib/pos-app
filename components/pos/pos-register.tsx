"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, Search, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { checkoutSaleAction } from "@/app/pos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { PosMenu, PosMenuProduct } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

type CartLine = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  note: string;
  variantOptionIds: string[];
  modifierOptionIds: string[];
  selectionLabel: string;
  unitMinor: bigint;
};

/** Renders the interactive outlet register while keeping all authoritative writes on the server. */
export function PosRegister({ menu }: { menu: PosMenu }) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [configuring, setConfiguring] = useState<PosMenuProduct | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return menu.products.filter((product) =>
      (categoryId === "all" || product.categoryId === categoryId)
      && (!query || `${product.name} ${product.sku ?? ""}`.toLocaleLowerCase("id-ID").includes(query)),
    );
  }, [categoryId, menu.products, search]);
  const subtotal = cart.reduce((sum, line) => sum + line.unitMinor * BigInt(line.quantity), 0n);
  const totals = calculateClientTotals(subtotal, menu.outlet.serviceChargeRate, menu.outlet.taxRate, menu.outlet.pricesIncludeTax);

  /** Adds one configured product as an independent cart line. */
  function addLine(line: Omit<CartLine, "id">) {
    setCart((current) => [...current, { ...line, id: crypto.randomUUID() }]);
  }

  /** Updates a cart quantity and preserves the server maximum of 99. */
  function changeQuantity(id: string, delta: number) {
    setCart((current) => current.map((line) => line.id === id
      ? { ...line, quantity: Math.min(99, Math.max(1, line.quantity + delta)) }
      : line));
  }

  return (
    <div className="grid min-h-[calc(100svh-8rem)] gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <section className="min-w-0" aria-labelledby="menu-heading">
        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Register · {menu.outlet.code}</p>
              <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl" id="menu-heading">Buat pesanan</h1>
              <p className="mt-1 text-sm text-muted-foreground">{menu.outlet.name} · harga outlet aktif</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Pajak {formatRate(menu.outlet.taxRate)}{menu.outlet.pricesIncludeTax ? " termasuk" : ""}</Badge>
              <Badge variant="outline">Layanan {formatRate(menu.outlet.serviceChargeRate)}</Badge>
            </div>
          </div>
          <label className="relative mt-5 block" htmlFor="pos-search">
            <span className="sr-only">Cari produk atau SKU</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input id="pos-search" className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Cari menu atau SKU…" type="search" value={search} />
          </label>
        </div>

        <div aria-label="Filter kategori" className="mt-4 flex gap-2 overflow-x-auto pb-2">
          <Button className="shrink-0" onClick={() => setCategoryId("all")} size="sm" variant={categoryId === "all" ? "default" : "outline"}>Semua</Button>
          {menu.categories.map((category) => <Button className="shrink-0" key={category.id} onClick={() => setCategoryId(category.id)} size="sm" variant={categoryId === category.id ? "default" : "outline"}>{category.name}</Button>)}
        </div>

        {menu.truncated && <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">Menu dibatasi 300 produk. Gunakan pencarian katalog untuk menata produk aktif.</p>}
        {filteredProducts.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed bg-card p-10 text-center"><p className="font-heading text-lg font-semibold">Menu tidak ditemukan</p><p className="mt-1 text-sm text-muted-foreground">Ubah pencarian atau kategori.</p></div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <button className="group min-h-32 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" key={product.id} onClick={() => {
                if (product.variantGroups.length || product.modifierGroups.length) setConfiguring(product);
                else addLine({ productId: product.id, productName: product.name, sku: product.sku, quantity: 1, note: "", variantOptionIds: [], modifierOptionIds: [], selectionLabel: "", unitMinor: parseMoneyToMinor(product.effectiveBasePrice) });
              }} type="button">
                <span className="grid size-10 place-items-center rounded-lg bg-accent font-heading font-semibold text-accent-foreground">{productMonogram(product.name)}</span>
                <span className="mt-3 flex items-start justify-between gap-3"><span className="min-w-0"><span className="block font-heading text-base font-semibold group-hover:text-primary">{product.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{product.sku ?? product.categoryName}</span></span><span className="shrink-0 font-mono text-sm font-semibold">{formatMinor(parseMoneyToMinor(product.effectiveBasePrice))}</span></span>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="hidden xl:block" aria-label="Pesanan saat ini">
        <div className="sticky top-5 overflow-hidden rounded-2xl border border-t-4 border-t-primary bg-card">
          <CartPanel cart={cart} changeQuantity={changeQuantity} onCheckout={() => setCheckoutOpen(true)} onRemove={(id) => setCart((current) => current.filter((line) => line.id !== id))} totals={totals} />
        </div>
      </aside>

      <button className="fixed right-4 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] left-4 z-30 flex min-h-14 items-center justify-between rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none xl:hidden" onClick={() => setMobileCartOpen(true)} type="button"><span className="flex items-center gap-2"><ShoppingBasket aria-hidden="true" className="size-5" />Pesanan · {cart.reduce((sum, line) => sum + line.quantity, 0)} item</span><span className="font-mono">{formatMinor(totals.total)}</span></button>

      <Dialog onOpenChange={setMobileCartOpen} open={mobileCartOpen}><DialogContent className="p-0 sm:p-0"><DialogHeader className="sr-only"><DialogTitle>Pesanan saat ini</DialogTitle><DialogDescription>Periksa item sebelum pembayaran.</DialogDescription></DialogHeader><CartPanel cart={cart} changeQuantity={changeQuantity} onCheckout={() => setCheckoutOpen(true)} onRemove={(id) => setCart((current) => current.filter((line) => line.id !== id))} totals={totals} /></DialogContent></Dialog>
      {configuring && <ProductConfigurator key={configuring.id} onAdd={(line) => { addLine(line); setConfiguring(null); }} onOpenChange={(open) => !open && setConfiguring(null)} product={configuring} />}
      <CheckoutDialog cart={cart} menu={menu} onOpenChange={setCheckoutOpen} onSuccess={() => { setCart([]); setMobileCartOpen(false); }} open={checkoutOpen} totals={totals} />
    </div>
  );
}

/** Collects variant and modifier choices for one cart line. */
function ProductConfigurator({ product, onAdd, onOpenChange }: {
  product: PosMenuProduct;
  onAdd: (line: Omit<CartLine, "id">) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [variants, setVariants] = useState<Record<string, string>>(() => Object.fromEntries(product.variantGroups.map((group) => [group.id, group.options[0]?.id ?? ""])));
  const [modifiers, setModifiers] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const activeProduct = product;
  const selectedOptions = [
    ...product.variantGroups.flatMap((group) => group.options.filter((option) => variants[group.id] === option.id)),
    ...product.modifierGroups.flatMap((group) => group.options.filter((option) => modifiers.has(option.id))),
  ];
  const unitMinor = selectedOptions.reduce((sum, option) => sum + parseMoneyToMinor(option.priceAdjustment), parseMoneyToMinor(product.effectiveBasePrice));

  /** Toggles a modifier while enforcing its maximum selection count in the UI. */
  function toggleModifier(group: PosMenuProduct["modifierGroups"][number], optionId: string) {
    setModifiers((current) => {
      const next = new Set(current);
      if (next.has(optionId)) next.delete(optionId);
      else if (group.options.filter((option) => next.has(option.id)).length < group.maxSelections) next.add(optionId);
      return next;
    });
  }

  /** Validates local selections and emits one complete cart line. */
  function submitConfiguration() {
    const invalid = activeProduct.modifierGroups.find((group) => {
      const count = group.options.filter((option) => modifiers.has(option.id)).length;
      return count < group.minSelections || count > group.maxSelections;
    });
    if (invalid) return toast.error(`Pilih ${invalid.minSelections}-${invalid.maxSelections} opsi ${invalid.name}.`);
    onAdd({
      productId: activeProduct.id,
      productName: activeProduct.name,
      sku: activeProduct.sku,
      quantity,
      note,
      variantOptionIds: Object.values(variants),
      modifierOptionIds: Array.from(modifiers),
      selectionLabel: selectedOptions.map((option) => option.name).join(" · "),
      unitMinor,
    });
  }

  return <Dialog onOpenChange={onOpenChange} open><DialogContent><DialogHeader><DialogTitle>{product.name}</DialogTitle><DialogDescription>Pilih opsi pesanan. Harga diperiksa kembali ketika checkout.</DialogDescription></DialogHeader><div className="grid gap-5">
    {product.variantGroups.map((group) => <fieldset className="grid gap-2" key={group.id}><legend className="mb-1 font-heading font-semibold">{group.name} <span className="text-destructive">*</span></legend>{group.options.map((option) => <label className={cn("flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3", variants[group.id] === option.id && "border-primary bg-primary/5")} key={option.id}><span className="flex items-center gap-3"><input checked={variants[group.id] === option.id} name={group.id} onChange={() => setVariants((current) => ({ ...current, [group.id]: option.id }))} type="radio" /><span>{option.name}</span></span><span className="font-mono text-sm">+{formatMinor(parseMoneyToMinor(option.priceAdjustment))}</span></label>)}</fieldset>)}
    {product.modifierGroups.map((group) => { const selectedCount = group.options.filter((option) => modifiers.has(option.id)).length; return <fieldset className="grid gap-2" key={group.id}><legend className="mb-1 font-heading font-semibold">{group.name} <span className="font-sans text-xs font-normal text-muted-foreground">Pilih {group.minSelections}-{group.maxSelections}</span></legend>{group.options.map((option) => { const checked = modifiers.has(option.id); const disabled = !checked && selectedCount >= group.maxSelections; return <label className={cn("flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3", checked && "border-primary bg-primary/5", disabled && "opacity-50")} key={option.id}><span className="flex items-center gap-3"><input checked={checked} disabled={disabled} onChange={() => toggleModifier(group, option.id)} type="checkbox" /><span>{option.name}</span></span><span className="font-mono text-sm">+{formatMinor(parseMoneyToMinor(option.priceAdjustment))}</span></label>; })}</fieldset>; })}
    <label className="grid gap-2"><span className="font-heading font-semibold">Catatan item <span className="font-sans text-xs font-normal text-muted-foreground">Opsional</span></span><Textarea maxLength={240} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: tanpa es" value={note} /></label>
  </div><DialogFooter><div className="mr-auto flex items-center gap-1"><Button aria-label="Kurangi jumlah" disabled={quantity === 1} onClick={() => setQuantity((value) => value - 1)} size="icon" type="button" variant="outline"><Minus /></Button><span className="w-10 text-center font-mono font-semibold">{quantity}</span><Button aria-label="Tambah jumlah" disabled={quantity === 99} onClick={() => setQuantity((value) => value + 1)} size="icon" type="button" variant="outline"><Plus /></Button></div><Button onClick={submitConfiguration} type="button">Tambah · {formatMinor(unitMinor * BigInt(quantity))}</Button></DialogFooter></DialogContent></Dialog>;
}

/** Displays current cart lines and the authoritative checkout summary preview. */
function CartPanel({ cart, totals, changeQuantity, onRemove, onCheckout }: {
  cart: CartLine[];
  totals: ReturnType<typeof calculateClientTotals>;
  changeQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}) {
  return <div className="flex min-h-full flex-col"><div className="border-b p-4"><div className="flex items-center justify-between"><h2 className="font-heading text-xl font-semibold">Tiket pesanan</h2><Badge variant="secondary">{cart.reduce((sum, line) => sum + line.quantity, 0)} item</Badge></div><p className="mt-1 text-sm text-muted-foreground">Periksa pilihan sebelum dibayar.</p></div>
    <div className="grid max-h-[55svh] gap-3 overflow-y-auto p-4 xl:max-h-[calc(100svh-28rem)]">{cart.length === 0 ? <div className="grid min-h-40 place-items-center rounded-xl border border-dashed text-center"><div><ShoppingBasket aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 font-semibold">Pesanan masih kosong</p><p className="mt-1 text-xs text-muted-foreground">Pilih produk dari menu.</p></div></div> : cart.map((line) => <article className="rounded-xl border p-3" key={line.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{line.productName}</h3>{line.selectionLabel && <p className="mt-1 text-xs leading-5 text-muted-foreground">{line.selectionLabel}</p>}{line.note && <p className="mt-1 text-xs italic text-muted-foreground">“{line.note}”</p>}</div><Button aria-label={`Hapus ${line.productName}`} onClick={() => onRemove(line.id)} size="icon-sm" type="button" variant="ghost"><Trash2 /></Button></div><div className="mt-3 flex items-center justify-between gap-3"><div className="flex items-center gap-1"><Button aria-label={`Kurangi ${line.productName}`} onClick={() => changeQuantity(line.id, -1)} size="icon-sm" type="button" variant="outline"><Minus /></Button><span className="w-7 text-center font-mono text-sm">{line.quantity}</span><Button aria-label={`Tambah ${line.productName}`} onClick={() => changeQuantity(line.id, 1)} size="icon-sm" type="button" variant="outline"><Plus /></Button></div><span className="font-mono font-semibold">{formatMinor(line.unitMinor * BigInt(line.quantity))}</span></div></article>)}</div>
    <div className="mt-auto border-t bg-muted/25 p-4"><dl className="grid gap-2 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatMinor(totals.subtotal)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Layanan</dt><dd className="font-mono">{formatMinor(totals.service)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Pajak {totals.includedTax ? "(termasuk)" : ""}</dt><dd className="font-mono">{formatMinor(totals.tax)}</dd></div><div className="mt-1 flex justify-between border-t pt-3 text-base font-semibold"><dt>Total</dt><dd className="font-mono text-primary">{formatMinor(totals.total)}</dd></div></dl><Button className="mt-4 w-full" disabled={cart.length === 0} onClick={onCheckout} type="button">Bayar sekarang</Button></div>
  </div>;
}

/** Collects payment details and calls the idempotent checkout Server Action. */
function CheckoutDialog({ cart, menu, totals, open, onOpenChange, onSuccess }: {
  cart: CartLine[];
  menu: PosMenu;
  totals: ReturnType<typeof calculateClientTotals>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [tableLabel, setTableLabel] = useState("");
  const [method, setMethod] = useState<"CASH" | "QRIS" | "DEBIT_CARD" | "CREDIT_CARD" | "BANK_TRANSFER">("CASH");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [checkoutToken, setCheckoutToken] = useState(() => crypto.randomUUID());

  /** Sends one checkout and preserves the cart when validation or persistence fails. */
  function submitCheckout() {
    if (orderType === "DINE_IN" && !tableLabel.trim()) return toast.error("Nomor atau nama meja wajib diisi.");
    if (method === "CASH" && (!tendered || parseMoneyToMinor(tendered) < totals.total)) return toast.error("Uang diterima kurang dari total pembayaran.");
    startTransition(async () => {
      const result = await checkoutSaleAction({
        checkoutToken,
        outletId: menu.outlet.id,
        orderType,
        tableLabel,
        items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity, note: line.note, variantOptionIds: line.variantOptionIds, modifierOptionIds: line.modifierOptionIds, expectedUnitPrice: minorToMoney(line.unitMinor) })),
        payment: { method, tenderedAmount: method === "CASH" ? minorToMoney(parseMoneyToMinor(tendered)) : undefined, reference },
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setCheckoutToken(crypto.randomUUID());
      onSuccess();
      onOpenChange(false);
      router.push(`/transactions/${result.saleId}`);
    });
  }

  return <Dialog onOpenChange={(value) => !pending && onOpenChange(value)} open={open}><DialogContent><DialogHeader><DialogTitle>Selesaikan pembayaran</DialogTitle><DialogDescription>Satu transaksi menggunakan satu metode pembayaran.</DialogDescription></DialogHeader><div className="grid gap-5">
    <fieldset><legend className="mb-2 font-heading font-semibold">Jenis pesanan</legend><div className="grid grid-cols-2 gap-2"><Button onClick={() => setOrderType("DINE_IN")} type="button" variant={orderType === "DINE_IN" ? "default" : "outline"}>{orderType === "DINE_IN" && <Check />}Dine-in</Button><Button onClick={() => setOrderType("TAKEAWAY")} type="button" variant={orderType === "TAKEAWAY" ? "default" : "outline"}>{orderType === "TAKEAWAY" && <Check />}Takeaway</Button></div></fieldset>
    {orderType === "DINE_IN" && <label className="grid gap-2" htmlFor="table-label"><span className="font-heading font-semibold">Nomor atau nama meja <span className="text-destructive">*</span></span><Input id="table-label" maxLength={40} onChange={(event) => setTableLabel(event.target.value)} placeholder="Contoh: A-07" value={tableLabel} /></label>}
    <fieldset><legend className="mb-2 font-heading font-semibold">Metode pembayaran</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{([['CASH','Tunai'],['QRIS','QRIS'],['DEBIT_CARD','Debit'],['CREDIT_CARD','Kredit'],['BANK_TRANSFER','Transfer']] as const).map(([value,label]) => <Button className="min-w-0" key={value} onClick={() => setMethod(value)} type="button" variant={method === value ? "default" : "outline"}>{label}</Button>)}</div></fieldset>
    {method === "CASH" ? <label className="grid gap-2" htmlFor="tendered"><span className="font-heading font-semibold">Uang diterima (Rp) <span className="text-destructive">*</span></span><Input id="tendered" inputMode="numeric" onChange={(event) => setTendered(event.target.value.replace(/\D/g, ""))} placeholder="50000" value={tendered} /><span className="text-sm text-muted-foreground">Kembalian: {formatMinor(tendered ? maxMinor(parseMoneyToMinor(tendered) - totals.total, 0n) : 0n)}</span></label> : <label className="grid gap-2" htmlFor="payment-reference"><span className="font-heading font-semibold">Referensi pembayaran <span className="font-sans text-xs font-normal text-muted-foreground">Opsional</span></span><Input id="payment-reference" maxLength={80} onChange={(event) => setReference(event.target.value)} placeholder="Nomor referensi" value={reference} /></label>}
    <div className="rounded-xl border border-t-4 border-t-primary bg-muted/25 p-4"><div className="flex items-center justify-between"><span className="font-semibold">Total pembayaran</span><span className="font-mono text-xl font-semibold text-primary">{formatMinor(totals.total)}</span></div></div>
  </div><DialogFooter><Button disabled={pending} onClick={submitCheckout} type="button">{pending && <Spinner />}{pending ? "Menyimpan…" : "Konfirmasi pembayaran"}</Button></DialogFooter></DialogContent></Dialog>;
}

/** Parses a positive decimal money string into integer minor units without floating point. */
function parseMoneyToMinor(value: string): bigint {
  const normalized = value.trim().replace(",", ".").replace(/[^\d.]/g, "");
  if (!normalized) return 0n;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const safeWhole = whole.replace(/\D/g, "") || "0";
  const safeFraction = fraction.replace(/\D/g, "").padEnd(2, "0").slice(0, 2);
  return BigInt(safeWhole) * 100n + BigInt(safeFraction);
}

/** Serializes integer minor units into the two-decimal shape accepted by checkout validation. */
function minorToMoney(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

/** Formats integer minor units as Indonesian Rupiah for display only. */
function formatMinor(value: bigint): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: value % 100n === 0n ? 0 : 2 }).format(Number(value) / 100);
}

/** Calculates the client preview with integer arithmetic matching server half-up rounding. */
function calculateClientTotals(subtotal: bigint, serviceRate: string, taxRate: string, pricesIncludeTax: boolean) {
  const serviceBasisPoints = parseRate(serviceRate);
  const taxBasisPoints = parseRate(taxRate);
  const service = roundDivide(subtotal * serviceBasisPoints, 10_000n);
  const tax = pricesIncludeTax
    ? roundDivide(subtotal * taxBasisPoints, 10_000n + taxBasisPoints)
    : roundDivide((subtotal + service) * taxBasisPoints, 10_000n);
  return { subtotal, service, tax, includedTax: pricesIncludeTax, total: subtotal + service + (pricesIncludeTax ? 0n : tax) };
}

/** Parses a two-decimal percentage into hundredths of one percent. */
function parseRate(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

/** Divides positive integers with half-up rounding. */
function roundDivide(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor;
}

/** Returns the greater integer minor-unit value. */
function maxMinor(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

/** Formats a decimal percentage for compact operational labels. */
function formatRate(value: string): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value))}%`;
}

/** Derives a two-letter product marker without requiring product images. */
function productMonogram(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
