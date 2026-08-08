"use client";

import { useActionState } from "react";
import { ArrowRight, MapPin } from "lucide-react";

import { selectOutletAction } from "@/app/select-outlet/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatOutletAddress } from "@/lib/outlets/normalization";
import type { OutletItem } from "@/lib/outlets/types";
import { initialOutletActionState } from "@/lib/outlets/types";

export function OutletSelector({ outlets, activeOutletId, activeShiftOutletId }: { outlets: OutletItem[]; activeOutletId?: string | null; activeShiftOutletId?: string }) {
  const [state, action, pending] = useActionState(selectOutletAction, initialOutletActionState);
  return (
    <div className="grid gap-3">
      {outlets.map((outlet) => {
        const hasActiveShift = outlet.id === activeShiftOutletId;
        return <form action={action} className="min-w-0" key={outlet.id}>
          <input name="outletId" type="hidden" value={outlet.id} />
          <Button className="h-auto min-h-20 w-full min-w-0 max-w-full justify-between gap-4 overflow-hidden border-border bg-card px-4 py-3 text-left hover:border-primary hover:bg-card" disabled={pending || Boolean(activeShiftOutletId && !hasActiveShift)} type="submit" variant="outline">
            <span className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent font-mono text-xs font-bold">{outlet.code.slice(0, 3)}</span>
              <span className="min-w-0 flex-1 overflow-hidden"><span className="flex min-w-0 items-center gap-2"><span className="truncate font-heading text-base font-semibold">{outlet.name}</span>{hasActiveShift && <Badge className="shrink-0">Shift aktif</Badge>}</span><span className="mt-1 flex min-w-0 items-center gap-1 text-xs font-normal text-muted-foreground"><MapPin aria-hidden="true" className="size-3 shrink-0" /><span className="truncate">{formatOutletAddress(outlet)}</span></span></span>
            </span>
            {pending ? <Spinner /> : <ArrowRight aria-hidden="true" className="shrink-0" />}
          </Button>
        </form>;
      })}
      {state.status === "error" && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      {activeOutletId && <p className="font-mono text-xs text-muted-foreground">Outlet aktif saat ini tetap digunakan sampai Anda memilih yang baru.</p>}
    </div>
  );
}
