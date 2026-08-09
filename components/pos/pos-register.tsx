"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, CheckCircle2, ChefHat, Clock3, FolderOpen, LayoutGrid, MessageSquareText, Minus, PanelLeftClose, PanelLeftOpen, Plus, Printer, ReceiptText, Save, Search, ShoppingBasket, Trash2, XCircle } from "lucide-react";
import { toast } from "react-toastify";

import { cancelOpenOrderAction, checkoutSaleAction, refreshOpenOrderPricingAction, saveOpenOrderAction, sendOrderToKitchenAction, updateOpenOrderAction } from "@/app/pos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import type { OpenOrder } from "@/lib/orders/types";
import { ProductImage } from "@/components/product-image";
import { getProductMonogram } from "@/lib/catalog/normalization";
import { cn } from "@/lib/utils";

type CartLine = {
  id: string;
  orderItemId?: string;
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
export function PosRegister({ menu, openOrders = [] }: { menu: PosMenu; openOrders?: OpenOrder[] }) {
  const [orderPending, startOrderTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [configuring, setConfiguring] = useState<PosMenuProduct | null>(null);
  const [categoryRailOpen, setCategoryRailOpen] = useState(true);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saveOrderOpen, setSaveOrderOpen] = useState(false);
  const [openOrdersOpen, setOpenOrdersOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<CartLine | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Pick<OpenOrder, "id" | "version" | "lastSentVersion" | "orderType" | "tableLabel"> | null>(null);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return menu.products.filter((product) =>
      (categoryId === "all" || product.categoryId === categoryId)
      && (!query || `${product.name} ${product.sku ?? ""}`.toLocaleLowerCase("id-ID").includes(query)),
    );
  }, [categoryId, menu.products, search]);
  const eagerImageProductId = filteredProducts.find((product) => product.imageUrl)?.id;
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

  /** Replaces one cart-line note while preserving its product configuration and server identity. */
  function updateLineNote(id: string, note: string) {
    setCart((current) => current.map((line) => line.id === id ? { ...line, note: note.trim() } : line));
    setNoteTarget(null);
  }

  /** Loads one shared open order into the register without trusting stale totals. */
  function resumeOrder(order: OpenOrder) {
    setChannelId(null);
    setCurrentOrder({ id: order.id, version: order.version, lastSentVersion: order.lastSentVersion, orderType: order.orderType, tableLabel: order.tableLabel });
    setCart(order.items.map((item) => ({ id: item.id, orderItemId: item.id, productId: item.productId, productName: item.productName, sku: item.sku, quantity: item.quantity, note: item.note, variantOptionIds: item.variantOptionIds, modifierOptionIds: item.modifierOptionIds, selectionLabel: item.selectionLabel, unitMinor: parseMoneyToMinor(item.unitPrice), directUnitMinor: parseMoneyToMinor(item.unitPrice) })));
    setOpenOrdersOpen(false);
    setMobileCartOpen(false);
  }

  /** Clears the current register after payment or when switching to another order. */
  function resetRegister() {
    setCart([]);
    setCurrentOrder(null);
    setNoteTarget(null);
    setMobileCartOpen(false);
  }

  /** Sends the current saved revision to the shared kitchen queue. */
  function sendCurrentOrder() {
    if (!currentOrder) return;
    startOrderTransition(async () => {
      const result = await sendOrderToKitchenAction({ orderId: currentOrder.id, outletId: menu.outlet.id, expectedVersion: currentOrder.version, operationToken: crypto.randomUUID() });
      if (result.status !== "success") { toast.error(result.message); return; }
      setCurrentOrder((value) => value ? { ...value, lastSentVersion: value.version } : value);
      toast.success(result.message);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-sm xl:grid xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col" aria-labelledby="menu-heading">
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
            {menu.outlet.openOrdersEnabled && <Button aria-label="Buka pesanan tersimpan" className="relative shrink-0" onClick={() => setOpenOrdersOpen(true)} size="icon" type="button" variant="outline"><FolderOpen aria-hidden="true" />{openOrders.length > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-primary font-mono text-[0.65rem] text-primary-foreground">{Math.min(openOrders.length, 99)}</span>}</Button>}
            <div className="hidden shrink-0 gap-2 2xl:flex">
              <Badge variant="secondary">Pajak {formatRate(menu.outlet.taxRate)}{selectedChannel || menu.outlet.pricesIncludeTax ? " termasuk" : ""}</Badge>
              <Badge variant="outline">{selectedChannel ? `Estimasi fee ${formatRate(selectedChannel.estimatedFeeRate)}` : `Layanan ${formatRate(menu.outlet.serviceChargeRate)}`}</Badge>
            </div>
          </div>
          {menu.deliveryChannels.length > 0 && <div aria-label="Sumber pesanan" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Button className="shrink-0" disabled={Boolean(currentOrder) || (cart.length > 0 && channelId !== null)} onClick={() => setChannelId(null)} size="sm" type="button" variant={channelId === null ? "default" : "outline"}>Langsung</Button>
            {menu.deliveryChannels.map((channel) => <Button className="shrink-0" disabled={Boolean(currentOrder) || (cart.length > 0 && channelId !== channel.id)} key={channel.id} onClick={() => setChannelId(channel.id)} size="sm" type="button" variant={channelId === channel.id ? "default" : "outline"}>{channel.label}</Button>)}
            {cart.length > 0 && <span className="self-center whitespace-nowrap text-xs text-muted-foreground">Kosongkan pesanan untuk mengganti sumber.</span>}
          </div>}
          {currentOrder && <div className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm"><span className="min-w-0 truncate font-semibold">Open order · {currentOrder.orderType === "DINE_IN" ? `Meja ${currentOrder.tableLabel}` : "Takeaway"}</span><Badge variant={currentOrder.version === currentOrder.lastSentVersion ? "secondary" : "outline"}>{currentOrder.version === currentOrder.lastSentVersion ? "Terkirim" : "Belum dikirim"}</Badge></div>}
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {categoryRailOpen && <aside aria-label="Kategori menu" className="hidden min-h-0 w-28 shrink-0 flex-col overflow-hidden border-r bg-card p-2 xl:flex xl:h-full" id="pos-category-rail">
            <button aria-current={categoryId === "all" ? "true" : undefined} className={cn("relative flex min-h-20 w-full min-w-0 max-w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", categoryId === "all" ? "border-primary bg-primary/8 text-primary" : "border-transparent bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground")} onClick={() => setCategoryId("all")} type="button"><LayoutGrid aria-hidden="true" className="size-5" /><span className="w-full min-w-0">Semua menu</span></button>
            <div className="mt-2 grid min-h-0 w-full min-w-0 flex-1 content-start gap-2 overflow-x-hidden overflow-y-auto">{menu.categories.map((category) => <button aria-current={categoryId === category.id ? "true" : undefined} className={cn("relative flex min-h-20 w-full min-w-0 max-w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", categoryId === category.id ? "border-primary bg-primary/8 text-primary" : "border-transparent bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground")} key={category.id} onClick={() => setCategoryId(category.id)} type="button"><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-background font-heading text-sm ring-1 ring-foreground/10">{getProductMonogram(category.name)}</span><span className="line-clamp-2 w-full min-w-0 break-words">{category.name}</span></button>)}</div>
          </aside>}

          <div aria-label="Daftar menu" className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20 p-3 pb-20 [scrollbar-gutter:stable] sm:p-4 sm:pb-20 xl:pb-4" role="region" tabIndex={0}>
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
                      <ProductImage className="absolute inset-0" fallbackClassName="text-2xl" imageUrl={product.imageUrl} loading={product.id === eagerImageProductId ? "eager" : "lazy"} name={product.name} positionX={product.imagePositionX} positionY={product.imagePositionY} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 20vw" />
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

      <aside className="hidden h-full min-h-0 flex-col border-l bg-card xl:flex" aria-label="Pesanan saat ini">
        <div className="border-b p-3">
          <RegisterClock timeZone={menu.outlet.timezone} />
        </div>
        <CartPanel canSave={Boolean(menu.outlet.openOrdersEnabled && !selectedChannel)} cart={cart} changeQuantity={changeQuantity} currentOrder={currentOrder} onCheckout={() => setCheckoutOpen(true)} onEditNote={setNoteTarget} onRemove={(id) => setCart((current) => current.filter((line) => line.id !== id))} onSave={() => setSaveOrderOpen(true)} onSend={sendCurrentOrder} pending={orderPending} totals={totals} />
      </aside>

      <button className="fixed right-4 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] left-4 z-30 flex min-h-14 items-center justify-between rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none xl:hidden" onClick={() => setMobileCartOpen(true)} type="button"><span className="flex items-center gap-2"><ShoppingBasket aria-hidden="true" className="size-5" />Pesanan · {cart.reduce((sum, line) => sum + line.quantity, 0)} item</span><span className="font-mono">{formatMinor(totals.total)}</span></button>

      <Dialog onOpenChange={setMobileCartOpen} open={mobileCartOpen}><DialogContent className="p-0 sm:p-0"><DialogHeader className="sr-only"><DialogTitle>Pesanan saat ini</DialogTitle><DialogDescription>Periksa item sebelum pembayaran.</DialogDescription></DialogHeader><CartPanel canSave={Boolean(menu.outlet.openOrdersEnabled && !selectedChannel)} cart={cart} changeQuantity={changeQuantity} currentOrder={currentOrder} onCheckout={() => setCheckoutOpen(true)} onEditNote={setNoteTarget} onRemove={(id) => setCart((current) => current.filter((line) => line.id !== id))} onSave={() => setSaveOrderOpen(true)} onSend={sendCurrentOrder} pending={orderPending} totals={totals} /></DialogContent></Dialog>
      {configuring && <ProductConfigurator channelId={channelId} key={`${configuring.id}:${channelId ?? "direct"}`} onAdd={(line) => { addLine(line); setConfiguring(null); }} onOpenChange={(open) => !open && setConfiguring(null)} product={configuring} />}
      {noteTarget && <ItemNoteDialog key={`${noteTarget.id}:${noteTarget.note}`} line={noteTarget} onOpenChange={(open) => !open && setNoteTarget(null)} onSave={updateLineNote} />}
      <OrderSaveDialog cart={cart} currentOrder={currentOrder} key={`save:${currentOrder?.id ?? "new"}:${currentOrder?.version ?? 0}:${saveOrderOpen}`} menu={menu} onOpenChange={setSaveOrderOpen} onSaved={(value, itemIds) => { setCurrentOrder(value); setCart((lines) => lines.map((line, index) => ({ ...line, id: itemIds[index] ?? line.id, orderItemId: itemIds[index] ?? line.orderItemId }))); }} open={saveOrderOpen} />
      {menu.outlet.openOrdersEnabled && <OpenOrdersDialog menu={menu} onCancelled={(orderId) => currentOrder?.id === orderId && resetRegister()} onResume={resumeOrder} open={openOrdersOpen} onOpenChange={setOpenOrdersOpen} orders={openOrders} />}
      <CheckoutDialog cart={cart} channel={selectedChannel} currentOrder={currentOrder} key={`checkout:${checkoutOpen}`} menu={menu} onOpenChange={setCheckoutOpen} onSuccess={resetRegister} open={checkoutOpen} totals={totals} />
    </div>
  );
}

/** Displays the current outlet time without rerendering the surrounding register. */
function RegisterClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, []);

  if (now === null) {
    return <time aria-label="Memuat waktu outlet" className="flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-background px-4" title={`Waktu outlet · ${timeZone}`}><span className="flex items-center gap-3"><Clock3 aria-hidden="true" className="size-5 text-primary" /><span className="font-mono text-xl font-semibold tabular-nums">--:--:--</span></span><span className="text-right text-xs text-muted-foreground">Waktu outlet</span></time>;
  }

  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now).replaceAll(".", ":");
  const day = new Intl.DateTimeFormat("id-ID", { timeZone, weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat("id-ID", { timeZone, day: "numeric", month: "long", year: "numeric" }).format(now);

  return <time aria-label={`${day}, ${date}, pukul ${time}`} className="flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-background px-4" dateTime={new Date(now).toISOString()} title={`Waktu outlet · ${timeZone}`}><span className="flex items-center gap-3"><Clock3 aria-hidden="true" className="size-5 text-primary" /><span className="font-mono text-xl font-semibold tabular-nums">{time}</span></span><span className="min-w-0 text-right"><span className="block truncate text-sm font-semibold capitalize">{day}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{date}</span></span></time>;
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
function CartPanel({ cart, totals, changeQuantity, onRemove, onCheckout, onEditNote, canSave, currentOrder, onSave, onSend, pending }: {
  cart: CartLine[];
  totals: ReturnType<typeof calculateClientTotals>;
  changeQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  onEditNote: (line: CartLine) => void;
  canSave: boolean;
  currentOrder: Pick<OpenOrder, "id" | "version" | "lastSentVersion"> | null;
  onSave: () => void;
  onSend: () => void;
  pending: boolean;
}) {
  return <div className="flex min-h-0 flex-1 flex-col"><div className="border-b p-4"><div className="flex items-center justify-between"><h2 className="font-heading text-xl font-semibold">Rincian pesanan</h2><Badge variant="secondary">{cart.reduce((sum, line) => sum + line.quantity, 0)} item</Badge></div><p className="mt-1 text-sm text-muted-foreground">Periksa pilihan sebelum dibayar.</p></div>
    <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-4">{cart.length === 0 ? <div className="grid min-h-56 place-items-center rounded-xl border border-dashed text-center xl:h-full"><div><span className="mx-auto grid size-14 place-items-center rounded-full bg-muted"><ShoppingBasket aria-hidden="true" className="size-6 text-muted-foreground" /></span><p className="mt-3 font-semibold">Belum ada pesanan</p><p className="mt-1 text-xs text-muted-foreground">Ketuk produk untuk menambahnya.</p></div></div> : cart.map((line) => <article className="rounded-xl border p-3" key={line.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{line.productName}</h3>{line.selectionLabel && <p className="mt-1 text-xs leading-5 text-muted-foreground">{line.selectionLabel}</p>}{line.note && <p className="mt-1 text-xs italic text-muted-foreground">“{line.note}”</p>}</div><div className="flex shrink-0 gap-1"><Button aria-label={`Ubah catatan ${line.productName}`} onClick={() => onEditNote(line)} size="icon-sm" title="Ubah catatan" type="button" variant="ghost"><MessageSquareText /></Button><Button aria-label={`Hapus ${line.productName}`} onClick={() => onRemove(line.id)} size="icon-sm" type="button" variant="ghost"><Trash2 /></Button></div></div><div className="mt-3 flex items-center justify-between gap-3"><div className="flex items-center gap-1"><Button aria-label={`Kurangi ${line.productName}`} onClick={() => changeQuantity(line.id, -1)} size="icon-sm" type="button" variant="outline"><Minus /></Button><span className="w-7 text-center font-mono text-sm">{line.quantity}</span><Button aria-label={`Tambah ${line.productName}`} onClick={() => changeQuantity(line.id, 1)} size="icon-sm" type="button" variant="outline"><Plus /></Button></div><span className="font-mono font-semibold">{formatMinor(line.unitMinor * BigInt(line.quantity))}</span></div></article>)}</div>
    <div className="mt-auto border-t bg-muted/25 p-4"><dl className="grid gap-2 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatMinor(totals.subtotal)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Layanan</dt><dd className="font-mono">{formatMinor(totals.service)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Pajak {totals.includedTax ? "(termasuk)" : ""}</dt><dd className="font-mono">{formatMinor(totals.tax)}</dd></div><div className="mt-1 flex justify-between border-t pt-3 text-base font-semibold"><dt>Total</dt><dd className="font-mono text-primary">{formatMinor(totals.total)}</dd></div></dl><div className="mt-4 grid grid-cols-2 gap-2">{canSave && <Button disabled={cart.length === 0 || pending} onClick={onSave} type="button" variant="outline"><Save aria-hidden="true" />{currentOrder ? "Simpan" : "Simpan order"}</Button>}{currentOrder && currentOrder.version !== currentOrder.lastSentVersion && <Button disabled={pending} onClick={onSend} type="button" variant="secondary">{pending ? <Spinner /> : <ChefHat aria-hidden="true" />}Kirim dapur</Button>}<Button className={cn(!canSave && !currentOrder && "col-span-2", currentOrder && currentOrder.version === currentOrder.lastSentVersion && "col-span-2")} disabled={cart.length === 0 || Boolean(currentOrder && currentOrder.version !== currentOrder.lastSentVersion)} onClick={onCheckout} type="button">Bayar sekarang</Button></div></div>
  </div>;
}

/** Edits or clears one item note without changing its quantity, options, or price. */
function ItemNoteDialog({ line, onOpenChange, onSave }: { line: CartLine; onOpenChange: (open: boolean) => void; onSave: (id: string, note: string) => void }) {
  const [note, setNote] = useState(line.note);

  return <Dialog onOpenChange={onOpenChange} open><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Catatan {line.productName}</DialogTitle><DialogDescription>Catatan ikut dikirim ke dapur setelah perubahan order disimpan.</DialogDescription></DialogHeader><label className="grid gap-2" htmlFor="cart-item-note"><span className="font-semibold">Catatan item <span className="text-xs font-normal text-muted-foreground">Opsional</span></span><Textarea autoFocus id="cart-item-note" maxLength={240} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: tanpa es" value={note} /><span className="text-right font-mono text-xs text-muted-foreground">{note.length}/240</span></label><DialogFooter className="gap-2 sm:justify-between"><Button disabled={!note.trim()} onClick={() => onSave(line.id, "")} type="button" variant="ghost">Hapus catatan</Button><Button onClick={() => onSave(line.id, note)} type="button"><MessageSquareText aria-hidden="true" />Simpan catatan</Button></DialogFooter></DialogContent></Dialog>;
}

/** Saves a new or resumed order without collecting payment. */
function OrderSaveDialog({ cart, currentOrder, menu, open, onOpenChange, onSaved }: {
  cart: CartLine[];
  currentOrder: Pick<OpenOrder, "id" | "version" | "lastSentVersion" | "orderType" | "tableLabel"> | null;
  menu: PosMenu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (order: Pick<OpenOrder, "id" | "version" | "lastSentVersion" | "orderType" | "tableLabel">, itemIds: string[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">(currentOrder?.orderType ?? "DINE_IN");
  const [tableLabel, setTableLabel] = useState(currentOrder?.tableLabel ?? "");
  const [reductionReason, setReductionReason] = useState("");

  /** Validates visible order metadata before invoking the matching save mutation. */
  function submit() {
    if (orderType === "DINE_IN" && !tableLabel.trim()) return toast.error("Nomor atau nama meja wajib diisi.");
    const content = { outletId: menu.outlet.id, orderType, tableLabel: orderType === "DINE_IN" ? tableLabel.trim() : undefined, items: cart.map((line) => ({ orderItemId: line.orderItemId, productId: line.productId, quantity: line.quantity, note: line.note, variantOptionIds: line.variantOptionIds, modifierOptionIds: line.modifierOptionIds, expectedUnitPrice: minorToMoney(line.unitMinor) })) };
    startTransition(async () => {
      const result = currentOrder
        ? await updateOpenOrderAction({ ...content, orderId: currentOrder.id, expectedVersion: currentOrder.version, operationToken: crypto.randomUUID(), reductionReason: reductionReason || undefined })
        : await saveOpenOrderAction({ ...content, operationToken: crypto.randomUUID() });
      if (result.status !== "success" || !result.orderId || !result.version) { toast.error(result.message); return; }
      onSaved({ id: result.orderId, version: result.version, lastSentVersion: currentOrder?.lastSentVersion ?? 0, orderType, tableLabel: orderType === "DINE_IN" ? tableLabel.trim() : null }, result.itemIds ?? []);
      toast.success(result.message);
      onOpenChange(false);
    });
  }

  return <Dialog onOpenChange={(value) => !pending && onOpenChange(value)} open={open}><DialogContent><DialogHeader><DialogTitle>{currentOrder ? "Simpan perubahan order" : "Simpan order"}</DialogTitle><DialogDescription>Order dapat dilanjutkan staf lain pada outlet yang sama.</DialogDescription></DialogHeader><div className="grid gap-4"><fieldset><legend className="mb-2 font-semibold">Jenis pesanan</legend><div className="grid grid-cols-2 gap-2"><Button onClick={() => setOrderType("DINE_IN")} type="button" variant={orderType === "DINE_IN" ? "default" : "outline"}>Dine-in</Button><Button onClick={() => setOrderType("TAKEAWAY")} type="button" variant={orderType === "TAKEAWAY" ? "default" : "outline"}>Takeaway</Button></div></fieldset>{orderType === "DINE_IN" && <label className="grid gap-2" htmlFor="saved-table-label"><span className="font-semibold">Nomor atau nama meja</span><Input id="saved-table-label" maxLength={40} onChange={(event) => setTableLabel(event.target.value)} placeholder="Contoh: A-07" value={tableLabel} /></label>}{currentOrder && <label className="grid gap-2" htmlFor="reduction-reason"><span className="font-semibold">Alasan pengurangan <span className="text-xs font-normal text-muted-foreground">Isi jika item dikurangi/dihapus</span></span><Textarea id="reduction-reason" maxLength={240} onChange={(event) => setReductionReason(event.target.value)} placeholder="Minimal 5 karakter" value={reductionReason} /></label>}<div className="flex items-center justify-between rounded-xl border bg-muted/25 p-3"><span className="text-sm font-medium">{cart.reduce((sum, item) => sum + item.quantity, 0)} item</span><span className="font-mono font-semibold">{formatMinor(cart.reduce((sum, item) => sum + item.unitMinor * BigInt(item.quantity), 0n))}</span></div></div><DialogFooter><Button disabled={pending} onClick={submit} type="button">{pending ? <Spinner /> : <Save aria-hidden="true" />}{pending ? "Menyimpan…" : "Simpan order"}</Button></DialogFooter></DialogContent></Dialog>;
}

/** Lists shared outlet orders and handles audited cancellation. */
function OpenOrdersDialog({ menu, open, onOpenChange, orders, onResume, onCancelled }: { menu: PosMenu; open: boolean; onOpenChange: (open: boolean) => void; orders: OpenOrder[]; onResume: (order: OpenOrder) => void; onCancelled: (orderId: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<OpenOrder | null>(null);
  const [reason, setReason] = useState("");
  /** Cancels the selected order with an audited reason and idempotency token. */
  function cancel() {
    if (!cancelTarget || reason.trim().length < 5) return toast.error("Alasan pembatalan minimal 5 karakter.");
    startTransition(async () => {
      const result = await cancelOpenOrderAction({ orderId: cancelTarget.id, outletId: menu.outlet.id, expectedVersion: cancelTarget.version, operationToken: crypto.randomUUID(), reason: reason.trim() });
      if (result.status !== "success") { toast.error(result.message); return; }
      onCancelled(cancelTarget.id);
      setCancelTarget(null);
      setReason("");
      toast.success(result.message);
    });
  }
  return <><Dialog onOpenChange={onOpenChange} open={open}><DialogContent className="sm:w-[min(42rem,calc(100vw-3rem))]"><DialogHeader><DialogTitle>Pesanan terbuka</DialogTitle><DialogDescription>Semua staf outlet dapat melanjutkan pesanan ini.</DialogDescription></DialogHeader><div className="grid max-h-[65svh] gap-3 overflow-y-auto pr-1">{orders.length ? orders.map((order) => <article className="rounded-xl border p-3" key={order.id}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{order.orderType === "DINE_IN" ? `Meja ${order.tableLabel}` : "Takeaway"}</h3><p className="mt-1 text-xs text-muted-foreground">{order.items.reduce((sum, item) => sum + item.quantity, 0)} item · {order.createdByName}</p></div><Badge variant={order.version === order.lastSentVersion ? "secondary" : "outline"}>{order.version === order.lastSentVersion ? "Terkirim" : "Ada perubahan"}</Badge></div><div className="mt-3 flex items-center justify-between border-t pt-3"><span className="font-mono font-semibold">{formatMinor(parseMoneyToMinor(order.total))}</span><div className="flex gap-2"><Button aria-label={`Batalkan ${order.tableLabel ?? "takeaway"}`} onClick={() => setCancelTarget(order)} size="sm" type="button" variant="ghost"><XCircle aria-hidden="true" />Batalkan</Button><Button onClick={() => onResume(order)} size="sm" type="button"><FolderOpen aria-hidden="true" />Lanjutkan</Button></div></div></article>) : <div className="grid min-h-48 place-items-center rounded-xl border border-dashed text-center"><div><FolderOpen aria-hidden="true" className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-semibold">Belum ada open order</p><p className="mt-1 text-sm text-muted-foreground">Simpan pesanan dari rincian kasir.</p></div></div>}</div></DialogContent></Dialog><Dialog onOpenChange={(value) => !value && !pending && setCancelTarget(null)} open={Boolean(cancelTarget)}><DialogContent><DialogHeader><DialogTitle>Batalkan open order?</DialogTitle><DialogDescription>Jika order sudah dikirim, dapur menerima delta pembatalan.</DialogDescription></DialogHeader><label className="grid gap-2" htmlFor="cancel-order-reason"><span className="font-semibold">Alasan pembatalan</span><Textarea id="cancel-order-reason" maxLength={240} onChange={(event) => setReason(event.target.value)} placeholder="Minimal 5 karakter" value={reason} /></label><DialogFooter><Button disabled={pending} onClick={cancel} type="button" variant="destructive">{pending ? <Spinner /> : <Trash2 aria-hidden="true" />}{pending ? "Membatalkan…" : "Batalkan pesanan"}</Button></DialogFooter></DialogContent></Dialog></>;
}

/** Collects payment details and calls the idempotent checkout Server Action. */
function CheckoutDialog({ cart, channel, currentOrder, menu, totals, open, onOpenChange, onSuccess }: {
  cart: CartLine[];
  channel: PosMenu["deliveryChannels"][number] | null;
  menu: PosMenu;
  totals: ReturnType<typeof calculateClientTotals>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currentOrder: Pick<OpenOrder, "id" | "version" | "lastSentVersion" | "orderType" | "tableLabel"> | null;
}) {
  const [pending, startTransition] = useTransition();
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">(currentOrder?.orderType ?? "DINE_IN");
  const [tableLabel, setTableLabel] = useState(currentOrder?.tableLabel ?? "");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [checkoutToken, setCheckoutToken] = useState(() => crypto.randomUUID());
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);

  /** Closes the checkout flow and resets transient fields for the next order. */
  function handleOpenChange(value: boolean) {
    if (pending && !receipt) return;
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
        orderId: currentOrder?.id,
        expectedVersion: currentOrder?.version,
        source: channel ? { type: "DELIVERY_PLATFORM", channelId: channel.id, externalOrderId: externalOrderId.trim() } : { type: "DIRECT" },
        orderType: channel ? "DELIVERY" : orderType,
        tableLabel: channel ? undefined : tableLabel,
        items: cart.map((line) => ({ orderItemId: line.orderItemId, productId: line.productId, quantity: line.quantity, note: line.note, variantOptionIds: line.variantOptionIds, modifierOptionIds: line.modifierOptionIds, expectedUnitPrice: minorToMoney(line.unitMinor) })),
        payment: channel ? undefined : { method, tenderedAmount: method === "CASH" ? minorToMoney(parseMoneyToMinor(tendered)) : undefined, reference },
      });
      if (result.status === "error") {
        if (result.code === "PRICE_CHANGED" && currentOrder && window.confirm(`${result.message}\n\nGunakan harga terbaru untuk order ini?`)) {
          const refreshed = await refreshOpenOrderPricingAction({ orderId: currentOrder.id, outletId: menu.outlet.id, expectedVersion: currentOrder.version, operationToken: crypto.randomUUID() });
          if (refreshed.status === "success" && refreshed.version) {
            onOpenChange(false);
            onSuccess();
            toast.success(`${refreshed.message} Buka kembali open order untuk melihat total baru.`);
            return;
          }
          toast.error(refreshed.message);
          return;
        }
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
      <fieldset disabled={Boolean(currentOrder)}><legend className="mb-2 font-heading font-semibold">Jenis pesanan</legend><div className="grid grid-cols-2 gap-2"><Button onClick={() => setOrderType("DINE_IN")} type="button" variant={orderType === "DINE_IN" ? "default" : "outline"}>{orderType === "DINE_IN" && <Check />}Dine-in</Button><Button onClick={() => setOrderType("TAKEAWAY")} type="button" variant={orderType === "TAKEAWAY" ? "default" : "outline"}>{orderType === "TAKEAWAY" && <Check />}Takeaway</Button></div></fieldset>
      {orderType === "DINE_IN" && <label className="grid gap-2" htmlFor="table-label"><span className="font-heading font-semibold">Nomor atau nama meja <span className="text-destructive">*</span></span><Input disabled={Boolean(currentOrder)} id="table-label" maxLength={40} onChange={(event) => setTableLabel(event.target.value)} placeholder="Contoh: A-07" value={tableLabel} /></label>}
      <fieldset><legend className="mb-2 font-heading font-semibold">Metode pembayaran</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{([['CASH','Tunai'],['QRIS','QRIS'],['DEBIT_CARD','Debit'],['CREDIT_CARD','Kredit'],['BANK_TRANSFER','Transfer']] as const).map(([value,label]) => <Button className="min-w-0" key={value} onClick={() => setMethod(value)} type="button" variant={method === value ? "default" : "outline"}>{label}</Button>)}</div></fieldset>
      {method === "CASH" ? <label className="grid gap-2" htmlFor="tendered"><span className="font-heading font-semibold">Uang diterima (Rp) <span className="text-destructive">*</span></span><CurrencyInput id="tendered" onValueChange={setTendered} placeholder="50.000" value={tendered} /><span className="text-sm text-muted-foreground">Kembalian: {formatMinor(tendered ? maxMinor(parseMoneyToMinor(tendered) - totals.total, 0n) : 0n)}</span></label> : <label className="grid gap-2" htmlFor="payment-reference"><span className="font-heading font-semibold">Referensi pembayaran <span className="font-sans text-xs font-normal text-muted-foreground">Opsional</span></span><Input id="payment-reference" maxLength={80} onChange={(event) => setReference(event.target.value)} placeholder="Nomor referensi" value={reference} /></label>}
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
