"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, CheckCircle2, Clock3, LayoutGrid, Minus, PanelLeftClose, PanelLeftOpen, Plus, Printer, ReceiptText, Search, ShoppingBasket, Trash2 } from "lucide-react";
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
import type { PosMenu, PosMenuOption, PosMenuProduct } from "@/lib/pos/types";
import { ProductImage } from "@/components/product-image";
import { getProductMonogram } from "@/lib/catalog/normalization";
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
  directUnitMinor: bigint;
};

type PaymentMethod = "CASH" | "QRIS" | "DEBIT_CARD" | "CREDIT_CARD" | "BANK_TRANSFER" | "DELIVERY_PLATFORM";

type ReceiptSnapshot = {
  receiptNumber: string;
  completedAt: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableLabel: string;
  deliveryLabel: string | null;
  externalOrderId: string | null;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  tenderedMinor: bigint | null;
  changeMinor: bigint | null;
  expectedSettlementAt: string | null;
  items: CartLine[];
  totals: ReturnType<typeof calculateClientTotals>;
};

/** Renders the interactive outlet register while keeping all authoritative writes on the server. */
export function PosRegister({ menu }: { menu: PosMenu }) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [configuring, setConfiguring] = useState<PosMenuProduct | null>(null);
  const [categoryRailOpen, setCategoryRailOpen] = useState(true);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return menu.products.filter((product) =>
      (categoryId === "all" || product.categoryId === categoryId)
      && (!query || `${product.name} ${product.sku ?? ""}`.toLocaleLowerCase("id-ID").includes(query)),
    );
  }, [categoryId, menu.products, search]);
  const selectedCategoryName = categoryId === "all"
    ? "Semua menu"
    : menu.categories.find((category) => category.id === categoryId)?.name ?? "Menu";
  const orderedQuantityByProduct = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const line of cart) quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
    return quantities;
  }, [cart]);
  const selectedChannel = menu.deliveryChannels.find((channel) => channel.id === channelId) ?? null;
  const subtotal = cart.reduce((sum, line) => sum + line.unitMinor * BigInt(line.quantity), 0n);
  const totals = calculateClientTotals(subtotal, selectedChannel ? "0.00" : menu.outlet.serviceChargeRate, menu.outlet.taxRate, selectedChannel ? true : menu.outlet.pricesIncludeTax);

  /** Adds quantity to an identical cart configuration or creates a line when its options differ. */
  function addLine(line: Omit<CartLine, "id">) {
    setCart((current) => {
      const existingIndex = current.findIndex((item) => hasSameCartConfiguration(item, line));
      if (existingIndex === -1) return [...current, { ...line, id: crypto.randomUUID() }];
      return current.map((item, index) => index === existingIndex
        ? { ...item, quantity: Math.min(99, item.quantity + line.quantity) }
        : item);
    });
  }

  /** Updates a cart quantity and preserves the server maximum of 99. */
  function changeQuantity(id: string, delta: number) {
    setCart((current) => current.map((line) => line.id === id
      ? { ...line, quantity: Math.min(99, Math.max(1, line.quantity + delta)) }
      : line));
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm xl:grid xl:h-[calc(100svh-2rem)] xl:min-h-[42rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="flex min-h-0 min-w-0 flex-col xl:h-full" aria-labelledby="menu-heading">
        <header className="border-b bg-card p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <Button aria-controls="pos-category-rail" aria-expanded={categoryRailOpen} aria-label={categoryRailOpen ? "Sembunyikan kategori" : "Tampilkan kategori"} className="hidden xl:inline-flex" onClick={() => setCategoryRailOpen((value) => !value)} size="icon" type="button" variant="ghost">
              {categoryRailOpen ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
            </Button>
            <div className="hidden min-w-40 sm:block">
              <p className="font-heading text-base font-semibold leading-tight" id="menu-heading">{menu.outlet.name}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">Register · {menu.outlet.code}</p>
            </div>
            <label className="relative min-w-0 flex-1 sm:mx-auto sm:max-w-xl" htmlFor="pos-search">
              <span className="sr-only">Cari produk atau SKU</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pos-search" className="bg-background pl-9 shadow-none" onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk…" type="search" value={search} />
            </label>
            <div className="hidden shrink-0 gap-2 2xl:flex">
              <Badge variant="secondary">Pajak {formatRate(menu.outlet.taxRate)}{selectedChannel || menu.outlet.pricesIncludeTax ? " termasuk" : ""}</Badge>
              <Badge variant="outline">{selectedChannel ? `Estimasi fee ${formatRate(selectedChannel.estimatedFeeRate)}` : `Layanan ${formatRate(menu.outlet.serviceChargeRate)}`}</Badge>
            </div>
          </div>
          {menu.deliveryChannels.length > 0 && <div aria-label="Sumber pesanan" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Button className="shrink-0" disabled={cart.length > 0 && channelId !== null} onClick={() => setChannelId(null)} size="sm" type="button" variant={channelId === null ? "default" : "outline"}>Langsung</Button>
            {menu.deliveryChannels.map((channel) => <Button className="shrink-0" disabled={cart.length > 0 && channelId !== channel.id} key={channel.id} onClick={() => setChannelId(channel.id)} size="sm" type="button" variant={channelId === channel.id ? "default" : "outline"}>{channel.label}</Button>)}
            {cart.length > 0 && <span className="self-center whitespace-nowrap text-xs text-muted-foreground">Kosongkan pesanan untuk mengganti sumber.</span>}
          </div>}
        </header>

        <div className="flex min-h-0 flex-1 xl:overflow-hidden">
          {categoryRailOpen && <aside aria-label="Kategori menu" className="hidden min-h-0 w-28 shrink-0 flex-col border-r bg-card p-2 xl:flex xl:h-full" id="pos-category-rail">
            <button aria-current={categoryId === "all" ? "true" : undefined} className={cn("relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", categoryId === "all" ? "border-primary bg-primary/8 text-primary" : "border-transparent bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground")} onClick={() => setCategoryId("all")} type="button"><LayoutGrid aria-hidden="true" className="size-5" /><span>Semua menu</span></button>
            <div className="mt-2 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto">{menu.categories.map((category) => <button aria-current={categoryId === category.id ? "true" : undefined} className={cn("relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", categoryId === category.id ? "border-primary bg-primary/8 text-primary" : "border-transparent bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground")} key={category.id} onClick={() => setCategoryId(category.id)} type="button"><span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-background font-heading text-sm ring-1 ring-foreground/10">{getProductMonogram(category.name)}</span><span className="line-clamp-2">{category.name}</span></button>)}</div>
          </aside>}

          <div aria-label="Daftar menu" className="min-h-0 min-w-0 flex-1 bg-muted/20 p-3 sm:p-4 xl:h-full xl:overflow-y-scroll xl:[scrollbar-gutter:stable]" role="region" tabIndex={0}>
            <div aria-label="Filter kategori" className="flex gap-2 overflow-x-auto pb-2 xl:hidden">
              <Button className="shrink-0" onClick={() => setCategoryId("all")} size="sm" variant={categoryId === "all" ? "default" : "outline"}>Semua</Button>
              {menu.categories.map((category) => <Button className="shrink-0" key={category.id} onClick={() => setCategoryId(category.id)} size="sm" variant={categoryId === category.id ? "default" : "outline"}>{category.name}</Button>)}
            </div>
            <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-heading text-lg font-semibold">{selectedCategoryName}</h2><p className="text-xs text-muted-foreground">Ketuk produk untuk menambah pesanan.</p></div><span className="font-mono text-xs text-muted-foreground">{filteredProducts.length} produk</span></div>
            {menu.truncated && <p className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">Menu dibatasi 300 produk. Gunakan pencarian katalog untuk menata produk aktif.</p>}
            {filteredProducts.length === 0 ? (
              <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-card text-center"><div><Search aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 font-heading text-lg font-semibold">Menu tidak ditemukan</p><p className="mt-1 text-sm text-muted-foreground">Ubah pencarian atau kategori.</p></div></div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {filteredProducts.map((product) => { const orderedQuantity = orderedQuantityByProduct.get(product.id) ?? 0; const productPrice = getProductBasePrice(product, channelId); return (
                  <button aria-label={`Tambah ${product.name} ke pesanan`} className={cn("group overflow-hidden rounded-xl border bg-card text-left shadow-xs transition-[border-color,box-shadow] hover:border-primary hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", orderedQuantity > 0 && "border-success shadow-sm")} key={product.id} onClick={() => {
                    if (product.variantGroups.length || product.modifierGroups.length) setConfiguring(product);
                    else addLine({ productId: product.id, productName: product.name, sku: product.sku, quantity: 1, note: "", variantOptionIds: [], modifierOptionIds: [], selectionLabel: "", unitMinor: parseMoneyToMinor(productPrice), directUnitMinor: parseMoneyToMinor(product.effectiveBasePrice) });
                  }} type="button">
                    <span className="relative grid aspect-square place-items-center overflow-hidden border-b bg-accent/35">
                      <ProductImage className="absolute inset-0" fallbackClassName="text-2xl" imageUrl={product.imageUrl} name={product.name} positionX={product.imagePositionX} positionY={product.imagePositionY} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 20vw" />
                      {orderedQuantity > 0 && <span aria-label={`${orderedQuantity} ${product.name} dalam pesanan`} className="absolute right-2 bottom-2 grid size-7 place-items-center rounded-full bg-success font-mono text-xs font-semibold text-success-foreground shadow-md">{orderedQuantity}</span>}
                    </span>
                    <span className="block p-3"><span className="block truncate font-heading text-sm font-semibold group-hover:text-primary">{product.name}</span><span className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[0.7rem] text-muted-foreground">{product.sku ?? product.categoryName}</span><span className="shrink-0 font-mono text-xs font-semibold">{formatMinor(parseMoneyToMinor(productPrice))}</span></span>{selectedChannel && <span className="mt-1 block text-[0.65rem] font-medium text-primary">Harga {selectedChannel.label}</span>}</span>
                    <span aria-hidden="true" className={cn("block h-1 transition-colors", orderedQuantity > 0 ? "bg-success" : "bg-transparent")} />
                  </button>
                ); })}
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="hidden min-h-0 flex-col border-l bg-card xl:flex" aria-label="Pesanan saat ini">
        <div className="border-b p-3">
          <RegisterClock timeZone={menu.outlet.timezone} />
        </div>
        <CartPanel cart={cart} changeQuantity={changeQuantity} onCheckout={() => setCheckoutOpen(true)} onRemove={(id) => setCart((current) => current.filter((line) => line.id !== id))} totals={totals} />
      </aside>

      <button className="fixed right-4 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] left-4 z-30 flex min-h-14 items-center justify-between rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none xl:hidden" onClick={() => setMobileCartOpen(true)} type="button"><span className="flex items-center gap-2"><ShoppingBasket aria-hidden="true" className="size-5" />Pesanan · {cart.reduce((sum, line) => sum + line.quantity, 0)} item</span><span className="font-mono">{formatMinor(totals.total)}</span></button>

      <Dialog onOpenChange={setMobileCartOpen} open={mobileCartOpen}><DialogContent className="p-0 sm:p-0"><DialogHeader className="sr-only"><DialogTitle>Pesanan saat ini</DialogTitle><DialogDescription>Periksa item sebelum pembayaran.</DialogDescription></DialogHeader><CartPanel cart={cart} changeQuantity={changeQuantity} onCheckout={() => setCheckoutOpen(true)} onRemove={(id) => setCart((current) => current.filter((line) => line.id !== id))} totals={totals} /></DialogContent></Dialog>
      {configuring && <ProductConfigurator channelId={channelId} key={`${configuring.id}:${channelId ?? "direct"}`} onAdd={(line) => { addLine(line); setConfiguring(null); }} onOpenChange={(open) => !open && setConfiguring(null)} product={configuring} />}
      <CheckoutDialog cart={cart} channel={selectedChannel} menu={menu} onOpenChange={setCheckoutOpen} onSuccess={() => { setCart([]); setMobileCartOpen(false); }} open={checkoutOpen} totals={totals} />
    </div>
  );
}

/** Displays the current outlet time without rerendering the surrounding register. */
function RegisterClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now).replaceAll(".", ":");
  const day = new Intl.DateTimeFormat("id-ID", { timeZone, weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat("id-ID", { timeZone, day: "numeric", month: "long", year: "numeric" }).format(now);

  return <time aria-label={`${day}, ${date}, pukul ${time}`} className="flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-background px-4" dateTime={new Date(now).toISOString()} suppressHydrationWarning title={`Waktu outlet · ${timeZone}`}><span className="flex items-center gap-3"><Clock3 aria-hidden="true" className="size-5 text-primary" /><span className="font-mono text-xl font-semibold tabular-nums">{time}</span></span><span className="min-w-0 text-right"><span className="block truncate text-sm font-semibold capitalize">{day}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{date}</span></span></time>;
}

/** Collects variant and modifier choices for one cart line. */
function ProductConfigurator({ product, channelId, onAdd, onOpenChange }: {
  product: PosMenuProduct;
  channelId: string | null;
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
  const unitMinor = selectedOptions.reduce((sum, option) => sum + parseMoneyToMinor(getOptionPriceAdjustment(option, channelId)), parseMoneyToMinor(getProductBasePrice(product, channelId)));
  const directUnitMinor = selectedOptions.reduce((sum, option) => sum + parseMoneyToMinor(option.priceAdjustment), parseMoneyToMinor(product.effectiveBasePrice));

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
      directUnitMinor,
    });
  }

  return <Dialog onOpenChange={onOpenChange} open><DialogContent><DialogHeader><DialogTitle>{product.name}</DialogTitle><DialogDescription>Pilih opsi pesanan. Harga diperiksa kembali ketika checkout.</DialogDescription></DialogHeader><div className="grid gap-5">
    {product.variantGroups.map((group) => <fieldset className="grid gap-2" key={group.id}><legend className="mb-1 font-heading font-semibold">{group.name} <span className="text-destructive">*</span></legend>{group.options.map((option) => <label className={cn("flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3", variants[group.id] === option.id && "border-primary bg-primary/5")} key={option.id}><span className="flex items-center gap-3"><input checked={variants[group.id] === option.id} name={group.id} onChange={() => setVariants((current) => ({ ...current, [group.id]: option.id }))} type="radio" /><span>{option.name}</span></span><span className="font-mono text-sm">+{formatMinor(parseMoneyToMinor(getOptionPriceAdjustment(option, channelId)))}</span></label>)}</fieldset>)}
    {product.modifierGroups.map((group) => { const selectedCount = group.options.filter((option) => modifiers.has(option.id)).length; return <fieldset className="grid gap-2" key={group.id}><legend className="mb-1 font-heading font-semibold">{group.name} <span className="font-sans text-xs font-normal text-muted-foreground">Pilih {group.minSelections}-{group.maxSelections}</span></legend>{group.options.map((option) => { const checked = modifiers.has(option.id); const disabled = !checked && selectedCount >= group.maxSelections; return <label className={cn("flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3", checked && "border-primary bg-primary/5", disabled && "opacity-50")} key={option.id}><span className="flex items-center gap-3"><input checked={checked} disabled={disabled} onChange={() => toggleModifier(group, option.id)} type="checkbox" /><span>{option.name}</span></span><span className="font-mono text-sm">+{formatMinor(parseMoneyToMinor(getOptionPriceAdjustment(option, channelId)))}</span></label>; })}</fieldset>; })}
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
  return <div className="flex min-h-0 flex-1 flex-col"><div className="border-b p-4"><div className="flex items-center justify-between"><h2 className="font-heading text-xl font-semibold">Rincian pesanan</h2><Badge variant="secondary">{cart.reduce((sum, line) => sum + line.quantity, 0)} item</Badge></div><p className="mt-1 text-sm text-muted-foreground">Periksa pilihan sebelum dibayar.</p></div>
    <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-4">{cart.length === 0 ? <div className="grid min-h-56 place-items-center rounded-xl border border-dashed text-center xl:h-full"><div><span className="mx-auto grid size-14 place-items-center rounded-full bg-muted"><ShoppingBasket aria-hidden="true" className="size-6 text-muted-foreground" /></span><p className="mt-3 font-semibold">Belum ada pesanan</p><p className="mt-1 text-xs text-muted-foreground">Ketuk produk untuk menambahnya.</p></div></div> : cart.map((line) => <article className="rounded-xl border p-3" key={line.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{line.productName}</h3>{line.selectionLabel && <p className="mt-1 text-xs leading-5 text-muted-foreground">{line.selectionLabel}</p>}{line.note && <p className="mt-1 text-xs italic text-muted-foreground">“{line.note}”</p>}</div><Button aria-label={`Hapus ${line.productName}`} onClick={() => onRemove(line.id)} size="icon-sm" type="button" variant="ghost"><Trash2 /></Button></div><div className="mt-3 flex items-center justify-between gap-3"><div className="flex items-center gap-1"><Button aria-label={`Kurangi ${line.productName}`} onClick={() => changeQuantity(line.id, -1)} size="icon-sm" type="button" variant="outline"><Minus /></Button><span className="w-7 text-center font-mono text-sm">{line.quantity}</span><Button aria-label={`Tambah ${line.productName}`} onClick={() => changeQuantity(line.id, 1)} size="icon-sm" type="button" variant="outline"><Plus /></Button></div><span className="font-mono font-semibold">{formatMinor(line.unitMinor * BigInt(line.quantity))}</span></div></article>)}</div>
    <div className="mt-auto border-t bg-muted/25 p-4"><dl className="grid gap-2 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatMinor(totals.subtotal)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Layanan</dt><dd className="font-mono">{formatMinor(totals.service)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Pajak {totals.includedTax ? "(termasuk)" : ""}</dt><dd className="font-mono">{formatMinor(totals.tax)}</dd></div><div className="mt-1 flex justify-between border-t pt-3 text-base font-semibold"><dt>Total</dt><dd className="font-mono text-primary">{formatMinor(totals.total)}</dd></div></dl><Button className="mt-4 w-full" disabled={cart.length === 0} onClick={onCheckout} type="button">Bayar sekarang</Button></div>
  </div>;
}

/** Collects payment details and calls the idempotent checkout Server Action. */
function CheckoutDialog({ cart, channel, menu, totals, open, onOpenChange, onSuccess }: {
  cart: CartLine[];
  channel: PosMenu["deliveryChannels"][number] | null;
  menu: PosMenu;
  totals: ReturnType<typeof calculateClientTotals>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [tableLabel, setTableLabel] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [checkoutToken, setCheckoutToken] = useState(() => crypto.randomUUID());
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);

  /** Closes the checkout flow and resets transient fields for the next order. */
  function handleOpenChange(value: boolean) {
    if (pending) return;
    if (!value) {
      setReceipt(null);
      setOrderType("DINE_IN");
      setTableLabel("");
      setMethod("CASH");
      setTendered("");
      setReference("");
      setExternalOrderId("");
    }
    onOpenChange(value);
  }

  /** Sends one checkout and preserves the cart when validation or persistence fails. */
  function submitCheckout() {
    if (channel && !externalOrderId.trim()) return toast.error("Nomor order platform wajib diisi.");
    if (!channel && orderType === "DINE_IN" && !tableLabel.trim()) return toast.error("Nomor atau nama meja wajib diisi.");
    if (!channel && method === "CASH" && (!tendered || parseMoneyToMinor(tendered) < totals.total)) return toast.error("Uang diterima kurang dari total pembayaran.");
    startTransition(async () => {
      const result = await checkoutSaleAction({
        checkoutToken,
        outletId: menu.outlet.id,
        source: channel ? { type: "DELIVERY_PLATFORM", channelId: channel.id, externalOrderId: externalOrderId.trim() } : { type: "DIRECT" },
        orderType: channel ? "DELIVERY" : orderType,
        tableLabel: channel ? undefined : tableLabel,
        items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity, note: line.note, variantOptionIds: line.variantOptionIds, modifierOptionIds: line.modifierOptionIds, expectedUnitPrice: minorToMoney(line.unitMinor) })),
        payment: channel ? undefined : { method, tenderedAmount: method === "CASH" ? minorToMoney(parseMoneyToMinor(tendered)) : undefined, reference },
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setReceipt({
        receiptNumber: result.receiptNumber,
        completedAt: new Date().toISOString(),
        orderType: channel ? "DELIVERY" : orderType,
        tableLabel: channel ? "" : tableLabel.trim(),
        deliveryLabel: channel?.label ?? null,
        externalOrderId: channel ? externalOrderId.trim() : null,
        paymentMethod: channel ? "DELIVERY_PLATFORM" : method,
        paymentReference: channel ? "" : reference.trim(),
        tenderedMinor: !channel && method === "CASH" ? parseMoneyToMinor(tendered) : null,
        changeMinor: result.changeAmount ? parseMoneyToMinor(result.changeAmount) : null,
        expectedSettlementAt: channel ? new Date(Date.now() + channel.settlementDelayHours * 60 * 60 * 1000).toISOString() : null,
        items: cart.map((line) => ({ ...line })),
        totals: { ...totals, total: parseMoneyToMinor(result.total) },
      });
      setCheckoutToken(crypto.randomUUID());
      onSuccess();
    });
  }

  return <Dialog onOpenChange={handleOpenChange} open={open}><DialogContent className={receipt ? "sm:w-[min(32rem,calc(100vw-3rem))]" : undefined}>{receipt ? <ReceiptPreview menu={menu} onClose={() => handleOpenChange(false)} receipt={receipt} /> : <><DialogHeader><DialogTitle>Selesaikan pembayaran</DialogTitle><DialogDescription>{channel ? `Order ${channel.label} akan dicatat sebagai piutang platform.` : "Satu transaksi menggunakan satu metode pembayaran."}</DialogDescription></DialogHeader><div className="grid gap-5">
    {channel ? <div className="grid gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4"><div className="flex items-center justify-between gap-3"><span className="font-semibold">Delivery · {channel.label}</span><Badge variant="outline">Settlement ±{channel.settlementDelayHours} jam</Badge></div><label className="grid gap-2" htmlFor="external-order-id"><span className="font-heading font-semibold">Nomor order platform <span className="text-destructive">*</span></span><Input id="external-order-id" maxLength={80} onChange={(event) => setExternalOrderId(event.target.value)} placeholder={`Contoh: ${channel.label.toUpperCase()}-12345`} value={externalOrderId} /></label></div> : <>
      <fieldset><legend className="mb-2 font-heading font-semibold">Jenis pesanan</legend><div className="grid grid-cols-2 gap-2"><Button onClick={() => setOrderType("DINE_IN")} type="button" variant={orderType === "DINE_IN" ? "default" : "outline"}>{orderType === "DINE_IN" && <Check />}Dine-in</Button><Button onClick={() => setOrderType("TAKEAWAY")} type="button" variant={orderType === "TAKEAWAY" ? "default" : "outline"}>{orderType === "TAKEAWAY" && <Check />}Takeaway</Button></div></fieldset>
      {orderType === "DINE_IN" && <label className="grid gap-2" htmlFor="table-label"><span className="font-heading font-semibold">Nomor atau nama meja <span className="text-destructive">*</span></span><Input id="table-label" maxLength={40} onChange={(event) => setTableLabel(event.target.value)} placeholder="Contoh: A-07" value={tableLabel} /></label>}
      <fieldset><legend className="mb-2 font-heading font-semibold">Metode pembayaran</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{([['CASH','Tunai'],['QRIS','QRIS'],['DEBIT_CARD','Debit'],['CREDIT_CARD','Kredit'],['BANK_TRANSFER','Transfer']] as const).map(([value,label]) => <Button className="min-w-0" key={value} onClick={() => setMethod(value)} type="button" variant={method === value ? "default" : "outline"}>{label}</Button>)}</div></fieldset>
      {method === "CASH" ? <label className="grid gap-2" htmlFor="tendered"><span className="font-heading font-semibold">Uang diterima (Rp) <span className="text-destructive">*</span></span><Input id="tendered" inputMode="numeric" onChange={(event) => setTendered(event.target.value.replace(/\D/g, ""))} placeholder="50000" value={tendered} /><span className="text-sm text-muted-foreground">Kembalian: {formatMinor(tendered ? maxMinor(parseMoneyToMinor(tendered) - totals.total, 0n) : 0n)}</span></label> : <label className="grid gap-2" htmlFor="payment-reference"><span className="font-heading font-semibold">Referensi pembayaran <span className="font-sans text-xs font-normal text-muted-foreground">Opsional</span></span><Input id="payment-reference" maxLength={80} onChange={(event) => setReference(event.target.value)} placeholder="Nomor referensi" value={reference} /></label>}
    </>}
    <div className="rounded-xl border border-t-4 border-t-primary bg-muted/25 p-4"><div className="flex items-center justify-between"><span className="font-semibold">Total pembayaran</span><span className="font-mono text-xl font-semibold text-primary">{formatMinor(totals.total)}</span></div></div>
  </div><DialogFooter><Button disabled={pending} onClick={submitCheckout} type="button">{pending && <Spinner />}{pending ? "Menyimpan…" : "Konfirmasi pembayaran"}</Button></DialogFooter></>}</DialogContent></Dialog>;
}

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT_CARD: "Kartu debit",
  CREDIT_CARD: "Kartu kredit",
  BANK_TRANSFER: "Transfer bank",
  DELIVERY_PLATFORM: "Dibayar melalui platform",
};

/** Shows the completed transaction in place and prints it on standard 80 mm thermal paper. */
function ReceiptPreview({ menu, receipt, onClose }: { menu: PosMenu; receipt: ReceiptSnapshot; onClose: () => void }) {
  const completedAt = new Intl.DateTimeFormat("id-ID", {
    timeZone: menu.outlet.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(receipt.completedAt));
  const itemCount = receipt.items.reduce((sum, item) => sum + item.quantity, 0);

  /** Opens the browser print dialog using the receipt-only 80 mm print stylesheet. */
  function printReceipt() {
    window.print();
  }

  return <article aria-label={`Struk transaksi ${receipt.receiptNumber}`} className="thermal-receipt text-sm">
    <header className="border-b border-dashed pb-4 text-center">
      <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-success print:hidden" />
      <p className="mt-2 font-heading text-lg font-semibold">{menu.outlet.name}</p>
      <p className="font-mono text-xs text-muted-foreground">{menu.outlet.code}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider">Pembayaran berhasil</p>
      <DialogTitle className="mt-1 font-mono text-base">{receipt.receiptNumber}</DialogTitle>
      <DialogDescription className="mt-1 text-xs">{completedAt}</DialogDescription>
    </header>

    <section aria-label="Informasi pesanan" className="grid gap-1 border-b border-dashed py-3 text-xs">
      <div className="flex justify-between gap-3"><span>Pesanan</span><span className="text-right font-semibold">{receipt.orderType === "DINE_IN" ? `Dine-in · Meja ${receipt.tableLabel}` : receipt.orderType === "DELIVERY" ? `Delivery · ${receipt.deliveryLabel}` : "Takeaway"}</span></div>
      {receipt.externalOrderId && <div className="flex justify-between gap-3"><span>Nomor order</span><span className="break-all text-right font-mono font-semibold">{receipt.externalOrderId}</span></div>}
      <div className="flex justify-between gap-3"><span>Pembayaran</span><span className="font-semibold">{paymentLabels[receipt.paymentMethod]}</span></div>
      <div className="flex justify-between gap-3"><span>Jumlah</span><span>{itemCount} item</span></div>
    </section>

    <section aria-label="Rincian pesanan" className="grid gap-3 border-b border-dashed py-3">
      {receipt.items.map((item) => <div key={item.id}>
        <div className="flex items-start justify-between gap-3"><span className="font-semibold">{item.quantity}× {item.productName}</span><span className="shrink-0 font-mono">{formatMinor(item.unitMinor * BigInt(item.quantity))}</span></div>
        <p className="font-mono text-[0.68rem] text-muted-foreground">{formatMinor(item.unitMinor)} / item</p>
        {item.selectionLabel && <p className="text-xs text-muted-foreground">{item.selectionLabel}</p>}
        {item.note && <p className="text-xs italic text-muted-foreground">Catatan: {item.note}</p>}
      </div>)}
    </section>

    <section aria-label="Ringkasan pembayaran" className="py-3">
      <dl className="grid gap-1.5 text-xs">
        <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-mono">{formatMinor(receipt.totals.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Layanan</dt><dd className="font-mono">{formatMinor(receipt.totals.service)}</dd></div>
        <div className="flex justify-between"><dt>Pajak {receipt.totals.includedTax ? "(termasuk)" : ""}</dt><dd className="font-mono">{formatMinor(receipt.totals.tax)}</dd></div>
        <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd className="font-mono">{formatMinor(receipt.totals.total)}</dd></div>
        {receipt.tenderedMinor !== null && <div className="flex justify-between"><dt>Uang diterima</dt><dd className="font-mono">{formatMinor(receipt.tenderedMinor)}</dd></div>}
        {receipt.changeMinor !== null && <div className="flex justify-between"><dt>Kembalian</dt><dd className="font-mono">{formatMinor(receipt.changeMinor)}</dd></div>}
        {receipt.paymentReference && <div className="flex justify-between gap-3"><dt>Referensi</dt><dd className="break-all text-right font-mono">{receipt.paymentReference}</dd></div>}
      </dl>
    </section>

    {receipt.expectedSettlementAt && <section className="mb-3 rounded-lg border border-dashed p-3 text-xs"><p className="font-semibold">Menunggu settlement platform</p><p className="mt-1 text-muted-foreground">Estimasi sebelum {new Intl.DateTimeFormat("id-ID", { timeZone: menu.outlet.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(receipt.expectedSettlementAt))}</p></section>}

    <footer className="border-t border-dashed pt-3 text-center text-xs text-muted-foreground"><ReceiptText aria-hidden="true" className="mx-auto mb-2 size-4 print:hidden" /><p>Terima kasih atas kunjungan Anda.</p></footer>
    <div className="mt-5 grid grid-cols-2 gap-2 print:hidden"><Button onClick={onClose} type="button" variant="outline">Pesanan baru</Button><Button onClick={printReceipt} type="button"><Printer aria-hidden="true" />Cetak struk</Button></div>
  </article>;
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

/** Compares product, variants, modifiers, and notes to decide whether two cart lines may merge. */
function hasSameCartConfiguration(left: Pick<CartLine, "productId" | "variantOptionIds" | "modifierOptionIds" | "note">, right: Pick<CartLine, "productId" | "variantOptionIds" | "modifierOptionIds" | "note">): boolean {
  return left.productId === right.productId
    && left.note.trim() === right.note.trim()
    && hasSameSelection(left.variantOptionIds, right.variantOptionIds)
    && hasSameSelection(left.modifierOptionIds, right.modifierOptionIds);
}

/** Compares option identifiers as an unordered set. */
function hasSameSelection(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/** Returns the active source price for one product without mutating menu data. */
function getProductBasePrice(product: PosMenuProduct, channelId: string | null): string {
  return channelId ? product.channelBasePrices.find((price) => price.channelId === channelId)?.basePrice ?? product.effectiveBasePrice : product.effectiveBasePrice;
}

/** Returns the active source adjustment for one variant or modifier option. */
function getOptionPriceAdjustment(option: PosMenuOption, channelId: string | null): string {
  return channelId ? option.channelPriceAdjustments.find((price) => price.channelId === channelId)?.priceAdjustment ?? option.priceAdjustment : option.priceAdjustment;
}
