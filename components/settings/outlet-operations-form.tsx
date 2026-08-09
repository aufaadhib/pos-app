"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "react-toastify";

import { updateOpenOrderSettingAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

/** Edits the active outlet's minimal POS operations settings. */
export function OutletOperationsForm({ outletId, initialEnabled }: { outletId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  /** Persists the changed feature flag and keeps feedback local to this control. */
  function save() {
    startTransition(async () => {
      const result = await updateOpenOrderSettingAction({ outletId, openOrdersEnabled: enabled });
      if (result.status === "success") toast.success(result.message);
      else toast.error(result.message);
    });
  }
  return <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
    <label className="flex min-h-12 cursor-pointer items-start gap-3" htmlFor="open-orders-enabled"><Checkbox checked={enabled} id="open-orders-enabled" onCheckedChange={(value) => setEnabled(value === true)} /><span><span className="block font-semibold">Izinkan simpan order</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">Kasir dapat menyimpan dine-in atau takeaway dan menerima pembayaran pada akhir layanan.</span></span></label>
    <Button className="min-h-11 sm:self-end" disabled={pending || enabled === initialEnabled} onClick={save} type="button">{pending ? <Spinner /> : <Save aria-hidden="true" />}{pending ? "Menyimpan…" : "Simpan"}</Button>
  </div>;
}
