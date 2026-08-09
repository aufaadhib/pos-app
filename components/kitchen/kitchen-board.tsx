"use client";

import { useTransition } from "react";
import { Check, ChefHat, Clock3, Flame } from "lucide-react";
import { toast } from "react-toastify";

import { updateKitchenTicketStatusAction } from "@/app/kitchen/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { KitchenTicketView } from "@/lib/orders/types";

const columns = [
  { status: "NEW", label: "Baru", icon: Clock3 },
  { status: "PROCESSING", label: "Diproses", icon: Flame },
  { status: "COMPLETED", label: "Selesai", icon: Check },
] as const;

/** Renders a touch-friendly three-state kitchen queue without horizontal page overflow. */
export function KitchenBoard({ outletId, tickets }: { outletId: string; tickets: KitchenTicketView[] }) {
  return <div className="grid min-w-0 gap-4 lg:grid-cols-3">{columns.map(({ status, label, icon: Icon }) => {
    const values = tickets.filter((ticket) => ticket.status === status);
    return <section aria-labelledby={`kitchen-${status}`} className="min-w-0 rounded-2xl border bg-card p-3 sm:p-4" key={status}><header className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-heading text-lg font-semibold" id={`kitchen-${status}`}><Icon aria-hidden="true" className="size-5 text-primary" />{label}</h2><Badge variant="secondary">{values.length}</Badge></header><div className="grid gap-3">{values.length ? values.map((ticket) => <TicketCard key={ticket.id} outletId={outletId} ticket={ticket} />) : <div className="grid min-h-28 place-items-center rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Belum ada ticket {label.toLocaleLowerCase("id-ID")}.</div>}</div></section>;
  })}</div>;
}

/** Shows one kitchen ticket and its only valid next-state action. */
function TicketCard({ outletId, ticket }: { outletId: string; ticket: KitchenTicketView }) {
  const [pending, startTransition] = useTransition();
  const nextStatus = ticket.status === "NEW" ? "PROCESSING" : ticket.status === "PROCESSING" ? "COMPLETED" : null;
  /** Advances the ticket and reports a scoped pending/result state. */
  function advance() {
    if (!nextStatus) return;
    startTransition(async () => {
      const result = await updateKitchenTicketStatusAction({ ticketId: ticket.id, outletId, status: nextStatus });
      if (result.status === "success") toast.success(result.message);
      else toast.error(result.message);
    });
  }
  const source = ticket.order.orderType === "DINE_IN" ? `Meja ${ticket.order.tableLabel}` : ticket.order.orderType === "DELIVERY" ? `Delivery ${ticket.order.externalOrderId ?? ""}` : "Takeaway";
  return <article className="min-w-0 rounded-xl border bg-background p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-sm font-bold">K-{ticket.number}</p><p className="mt-1 truncate text-sm font-semibold">{source}</p></div><Badge variant={ticket.kind === "DELTA" ? "destructive" : "outline"}>{ticket.kind === "DELTA" ? "Perubahan" : "Awal"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(ticket.sentAt))} · {ticket.sentByName}</p><div className="mt-3 grid gap-2 border-y py-3">{ticket.lines.map((line) => <div className="text-sm" key={line.id}><div className="flex items-start gap-2"><span className="w-8 shrink-0 font-mono font-bold">{line.action === "REMOVE" ? "−" : line.action === "UPDATE" ? "~" : "+"}{line.quantity}</span><span className="min-w-0 font-semibold">{line.productName}</span></div>{line.selectionLabel && <p className="ml-10 text-xs text-muted-foreground">{line.selectionLabel}</p>}{line.note && <p className="ml-10 text-xs italic">Catatan: {line.note}</p>}{line.reason && <p className="ml-10 text-xs text-destructive">Alasan: {line.reason}</p>}</div>)}</div>{nextStatus && <Button className="mt-3 min-h-11 w-full" disabled={pending} onClick={advance} type="button">{pending ? <Spinner /> : ticket.status === "NEW" ? <ChefHat aria-hidden="true" /> : <Check aria-hidden="true" />}{pending ? "Memperbarui…" : ticket.status === "NEW" ? "Mulai proses" : "Tandai selesai"}</Button>}</article>;
}
