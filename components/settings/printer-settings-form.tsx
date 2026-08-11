"use client";

import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { CheckCircle2, CircleOff, Info, Printer, Save } from "lucide-react";
import { toast } from "react-toastify";

import { updatePrinterSettingsAction } from "@/app/settings/printer-actions";
import { ReceiptPaperSheet } from "@/components/receipt/receipt-paper-sheet";
import type { ReceiptRendererData } from "@/components/receipt/receipt-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAutoPrintPreference, setAutoPrintPreference, subscribeAutoPrintPreference } from "@/lib/printers/device-preference";
import type { ReceiptPaperSizeValue } from "@/lib/printers/types";
import { cn } from "@/lib/utils";

const sampleReceipt: ReceiptRendererData = {
  receiptNumber: "CONTOH-0001",
  completedAt: "2026-08-09T07:30:00.000Z",
  orderType: "DINE_IN",
  tableLabel: "A-07",
  deliveryLabel: null,
  externalOrderId: null,
  paymentMethod: "CASH",
  paymentReference: "",
  tenderedMinor: 100_000_00n,
  changeMinor: 37_750_00n,
  expectedSettlementAt: null,
  items: [
    { id: "sample-1", productName: "Kopi susu", quantity: 2, note: "", selectionLabel: "Es · Gula normal", unitMinor: 25_000_00n },
    { id: "sample-2", productName: "Roti bakar", quantity: 1, note: "Potong empat", selectionLabel: "Cokelat", unitMinor: 12_250_00n },
  ],
  totals: { subtotal: 62_250_00n, service: 0n, tax: 0n, includedTax: false, total: 62_250_00n },
};

/** Supplies the hydration-safe default before browser storage becomes available. */
const getManualPrintSnapshot = () => false;

/** Edits outlet receipt settings and the current browser's independent auto-print preference. */
export function PrinterSettingsForm({ outlet }: {
  outlet: {
    id: string;
    code: string;
    name: string;
    receiptPaperSize: ReceiptPaperSizeValue;
    receiptFooter: string;
  };
}) {
  const [paperSize, setPaperSize] = useState(outlet.receiptPaperSize);
  const [footer, setFooter] = useState(outlet.receiptFooter);
  const [baseline, setBaseline] = useState({ paperSize: outlet.receiptPaperSize, footer: outlet.receiptFooter });
  const [pending, startTransition] = useTransition();
  const subscribeAutoPrint = useCallback((onStoreChange: () => void) => subscribeAutoPrintPreference(outlet.id, onStoreChange), [outlet.id]);
  const readAutoPrint = useCallback(() => getAutoPrintPreference(outlet.id), [outlet.id]);
  const autoPrint = useSyncExternalStore(subscribeAutoPrint, readAutoPrint, getManualPrintSnapshot);
  const normalizedFooter = footer.trim();
  const changed = paperSize !== baseline.paperSize || normalizedFooter !== baseline.footer;

  /** Persists the outlet-shared paper and footer settings after server validation. */
  function saveSettings() {
    startTransition(async () => {
      const result = await updatePrinterSettingsAction({
        outletId: outlet.id,
        receiptPaperSize: paperSize,
        receiptFooter: footer,
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setFooter(normalizedFooter);
      setBaseline({ paperSize, footer: normalizedFooter });
      toast.success(result.message);
    });
  }

  /** Stores auto-print only in this browser and returns to manual mode if storage is blocked. */
  function changeAutoPrint(enabled: boolean) {
    if (!setAutoPrintPreference(outlet.id, enabled)) {
      if (enabled) toast.error("Penyimpanan browser tidak tersedia. Cetak otomatis tetap nonaktif.");
      return;
    }
  }

  /** Opens the browser print dialog with the current example receipt only. */
  function printSample() {
    window.print();
  }

  return <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
    <section aria-labelledby="printer-options-heading" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold" id="printer-options-heading">Format struk pelanggan</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Ukuran dan footer berlaku untuk semua perangkat di outlet ini.</p>
      </div>

      <div className="mt-6 grid gap-5">
        <label className="grid gap-2" htmlFor="receipt-paper-size">
          <span className="font-semibold">Ukuran kertas</span>
          <Select onValueChange={(value) => value && setPaperSize(value as ReceiptPaperSizeValue)} value={paperSize}>
            <SelectTrigger className="h-11 w-full" id="receipt-paper-size"><SelectValue>{paperSize === "MM58" ? "58 mm · area isi 52 mm" : "80 mm · area isi 72 mm"}</SelectValue></SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="MM58">58 mm · area isi 52 mm</SelectItem>
              <SelectItem value="MM80">80 mm · area isi 72 mm</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-2" htmlFor="receipt-footer">
          <span className="flex items-center justify-between gap-3 font-semibold"><span>Footer struk <span className="text-xs font-normal text-muted-foreground">Opsional</span></span><span className="font-mono text-xs font-normal text-muted-foreground">{footer.length}/160</span></span>
          <Textarea id="receipt-footer" maxLength={160} onChange={(event) => setFooter(event.target.value)} placeholder="Kosongkan untuk menyembunyikan footer" rows={3} value={footer} />
          <span className="text-xs text-muted-foreground">Spasi di awal dan akhir akan dihapus saat disimpan.</span>
        </label>

        <div className={cn("rounded-xl border p-4 transition-colors", autoPrint ? "border-success/45 bg-success/10" : "border-destructive/40 bg-destructive/10")}>
          <div className="flex min-h-11 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0" id="receipt-auto-print-label">
              <span className="flex flex-wrap items-center gap-2 font-semibold">Buka dialog cetak browser otomatis <Badge variant="outline">Hanya perangkat ini</Badge></span>
              <span className={cn("mt-1 block text-sm font-medium leading-6", autoPrint ? "text-success" : "text-destructive")}>
                {autoPrint
                  ? "Aktif. Dialog browser akan terbuka otomatis setelah preview struk siap."
                  : "Nonaktif. Dialog browser tidak akan terbuka otomatis; cetak struk secara manual dari preview."}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3 self-start sm:mt-1 sm:self-auto">
              <Badge className={cn("h-7 gap-1.5 px-2.5 font-semibold", autoPrint ? "border-success bg-success text-success-foreground" : "border-destructive/40 bg-destructive/15 text-destructive")} variant="outline">
                {autoPrint ? <CheckCircle2 aria-hidden="true" /> : <CircleOff aria-hidden="true" />}{autoPrint ? "Aktif" : "Nonaktif"}
              </Badge>
              <Switch aria-labelledby="receipt-auto-print-label" checked={autoPrint} className="data-checked:bg-success data-unchecked:bg-destructive/35" onCheckedChange={changeAutoPrint} />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>Printer fisik, jumlah salinan, dan orientasi tetap dipilih melalui dialog browser.</p>
        </div>

        <Button className="min-h-11 w-full sm:w-auto sm:justify-self-end" disabled={pending || !changed} onClick={saveSettings} type="button">
          {pending ? <Spinner /> : <Save aria-hidden="true" />}{pending ? "Menyimpan…" : "Simpan perubahan"}
        </Button>
      </div>
    </section>

    <aside aria-labelledby="receipt-preview-heading" className="min-w-0 rounded-2xl border bg-muted/35 p-3 sm:p-5 lg:sticky lg:top-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="font-heading font-semibold" id="receipt-preview-heading">Preview struk</h2><p className="text-xs text-muted-foreground">{paperSize === "MM58" ? "Kertas 58 mm · area cetak 52 mm" : "Kertas 80 mm · area cetak 72 mm"}</p></div>
        <Button className="min-h-11" onClick={printSample} type="button" variant="outline"><Printer aria-hidden="true" />Cetak contoh</Button>
      </div>
      <div className="overflow-hidden rounded-xl bg-background p-3 shadow-inner sm:p-5">
        <ReceiptPaperSheet data={sampleReceipt} outlet={{ ...outlet, timezone: "Asia/Jakarta", receiptPaperSize: paperSize, receiptFooter: footer }} />
      </div>
    </aside>
  </div>;
}
