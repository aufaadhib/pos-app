"use client";

import { useActionState, useEffect, useState } from "react";
import { Archive, Building2, Pencil, Plus, RotateCcw } from "lucide-react";

import {
  archiveOutletAction,
  createOutletAction,
  restoreOutletAction,
  updateOutletAction,
} from "@/app/outlets/actions";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAutoCloseDialogAction } from "@/components/ui/use-auto-close-dialog-action";
import type { OutletItem } from "@/lib/outlets/types";
import { initialOutletActionState } from "@/lib/outlets/types";
import { suggestOutletCode, normalizeOutletCode } from "@/lib/outlets/normalization";
import { supportedOutletTimezones } from "@/lib/outlets/validation";
import type { RegionOption } from "@/lib/regions/service";

export function OutletFormDialog({ outlet }: { outlet?: OutletItem }) {
  const isEditing = Boolean(outlet);
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(
    isEditing ? updateOutletAction : createOutletAction,
    initialOutletActionState,
  );
  const [name, setName] = useState(outlet?.name ?? "");
  const [code, setCode] = useState(outlet?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(isEditing);
  const [provinceCode, setProvinceCode] = useState(outlet?.provinceCode ?? "");
  const [cityCode, setCityCode] = useState(outlet?.cityCode ?? "");
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [regencies, setRegencies] = useState<RegionOption[]>([]);
  const [regionError, setRegionError] = useState("");
  const [regionsLoading, setRegionsLoading] = useState(false);

  async function loadProvinces() {
    if (provinces.length > 0) return;
    setRegionsLoading(true);
    setRegionError("");
    try {
      const response = await fetch("/api/regions/provinces");
      const payload = await response.json() as { data?: RegionOption[]; message?: string };
      if (!response.ok || !payload.data) throw new Error(payload.message);
      setProvinces(payload.data);
    } catch {
      setRegionError("Daftar provinsi belum dapat dimuat. Tutup lalu buka kembali form.");
    } finally {
      setRegionsLoading(false);
    }
  }

  useEffect(() => {
    if (!provinceCode) return;
    let active = true;
    fetch(`/api/regions/regencies?province=${encodeURIComponent(provinceCode)}`)
      .then(async (response) => {
        const payload = await response.json() as { data?: RegionOption[]; message?: string };
        if (!response.ok || !payload.data) throw new Error(payload.message);
        if (active) setRegencies(payload.data);
      })
      .catch(() => {
        if (active) setRegionError("Daftar kabupaten/kota belum dapat dimuat.");
      })
      .finally(() => {
        if (active) setRegionsLoading(false);
      });
    return () => { active = false; };
  }, [provinceCode]);

  const provinceName = provinces.find((item) => item.code === provinceCode)?.name
    ?? (outlet?.provinceCode === provinceCode ? outlet.provinceName : "");
  const cityName = regencies.find((item) => item.code === cityCode)?.name
    ?? (outlet?.cityCode === cityCode ? outlet.cityName : "");

  return (
    <Dialog onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) void loadProvinces(); }} open={open}>
      <DialogTrigger render={<Button size={isEditing ? "icon" : "default"} variant={isEditing ? "ghost" : "default"} />}>
        {isEditing ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        <span className={isEditing ? "sr-only" : undefined}>{isEditing ? `Edit ${outlet?.name}` : "Outlet baru"}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit outlet" : "Buka outlet baru"}</DialogTitle>
          <DialogDescription>
            Identitas ini menjadi konteks kerja staf, session, dan transaksi pada milestone berikutnya.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-5">
          {outlet && <><input name="id" type="hidden" value={outlet.id} /><input name="expectedUpdatedAt" type="hidden" value={outlet.updatedAt} /></>}
          <input name="provinceCode" type="hidden" value={provinceCode} />
          <input name="provinceName" type="hidden" value={provinceName} />
          <input name="cityCode" type="hidden" value={cityCode} />
          <input name="cityName" type="hidden" value={cityName} />
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
              <OutletField
                errors={state.fieldErrors?.name}
                label="Nama outlet"
                maxLength={80}
                name="name"
                onChange={(event) => {
                  const nextName = event.target.value;
                  setName(nextName);
                  if (!codeTouched) setCode(suggestOutletCode(nextName));
                }}
                placeholder="Glutong Kemang"
                value={name}
              />
              <OutletField
                errors={state.fieldErrors?.code}
                label="Kode"
                maxLength={12}
                name="code"
                onChange={(event) => { setCodeTouched(true); setCode(normalizeOutletCode(event.target.value)); }}
                placeholder="KMG"
                value={code}
              />
            </div>
            <OutletField
              defaultValue={outlet?.addressLine ?? ""}
              errors={state.fieldErrors?.addressLine}
              label="Alamat jalan (opsional)"
              maxLength={240}
              name="addressLine"
              placeholder="Jl. Kemang Raya No. 10"
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(state.fieldErrors?.provinceCode)}>
                <FieldLabel htmlFor={`province-${outlet?.id ?? "new"}`}>Provinsi</FieldLabel>
                <SearchableSelect aria-invalid={Boolean(state.fieldErrors?.provinceCode)} disabled={regionsLoading && provinces.length === 0} id={`province-${outlet?.id ?? "new"}`} onValueChange={(value) => { setRegionError(""); setRegionsLoading(true); setProvinceCode(value); setCityCode(""); setRegencies([]); }} options={provinces.map((region) => ({ label: region.name, value: region.code }))} placeholder="Cari provinsi" value={provinceCode} />
                <FieldError errors={toFieldErrors(state.fieldErrors?.provinceCode)} />
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.cityCode)}>
                <FieldLabel htmlFor={`city-${outlet?.id ?? "new"}`}>Kabupaten/kota</FieldLabel>
                <SearchableSelect aria-invalid={Boolean(state.fieldErrors?.cityCode)} disabled={!provinceCode || regionsLoading} id={`city-${outlet?.id ?? "new"}`} onValueChange={setCityCode} options={regencies.map((region) => ({ label: region.name, value: region.code }))} placeholder="Cari kabupaten/kota" value={cityCode} />
                <FieldError errors={toFieldErrors(state.fieldErrors?.cityCode)} />
              </Field>
            </div>
            <Field data-invalid={Boolean(state.fieldErrors?.timezone)}>
              <FieldLabel htmlFor={`timezone-${outlet?.id ?? "new"}`}>Zona waktu</FieldLabel>
              <SearchableSelect defaultValue={outlet?.timezone ?? "Asia/Jakarta"} id={`timezone-${outlet?.id ?? "new"}`} name="timezone" options={supportedOutletTimezones.map((timezone) => ({ label: timezoneLabel(timezone), value: timezone }))} placeholder="Cari zona waktu" />
              <FieldError errors={toFieldErrors(state.fieldErrors?.timezone)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <OutletField
                defaultValue={outlet?.taxRate ?? "0"}
                errors={state.fieldErrors?.taxRate}
                inputMode="decimal"
                label="Pajak (%)"
                name="taxRate"
                placeholder="10"
              />
              <OutletField
                defaultValue={outlet?.serviceChargeRate ?? "0"}
                errors={state.fieldErrors?.serviceChargeRate}
                inputMode="decimal"
                label="Biaya layanan (%)"
                name="serviceChargeRate"
                placeholder="5"
              />
            </div>
            <Field orientation="horizontal">
              <Checkbox defaultChecked={outlet?.pricesIncludeTax ?? false} id={`prices-include-tax-${outlet?.id ?? "new"}`} name="pricesIncludeTax" />
              <div>
                <FieldLabel htmlFor={`prices-include-tax-${outlet?.id ?? "new"}`}>Harga menu sudah termasuk pajak</FieldLabel>
                <p className="text-sm text-muted-foreground">Biaya layanan tetap ditampilkan terpisah saat transaksi.</p>
              </div>
            </Field>
          </FieldGroup>
          {regionError && <Alert variant="destructive"><AlertDescription>{regionError}</AlertDescription></Alert>}
          {state.status !== "idle" && state.status !== "success" && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
          <DialogFooter><Button disabled={pending || regionsLoading} type="submit">{pending && <Spinner />}{pending ? "Menyimpan…" : "Simpan outlet"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OutletStatusAction({ outlet }: { outlet: OutletItem }) {
  const restoring = outlet.status === "ARCHIVED";
  const [state, action, pending] = useActionState(restoring ? restoreOutletAction : archiveOutletAction, initialOutletActionState);
  if (restoring) return (
    <form action={action} className="grid justify-items-end gap-1">
      <input name="id" type="hidden" value={outlet.id} /><input name="expectedUpdatedAt" type="hidden" value={outlet.updatedAt} />
      <Button aria-label={`${restoring ? "Pulihkan" : "Arsipkan"} ${outlet.name}`} disabled={pending} size="icon" type="submit" variant={restoring ? "outline" : "ghost"}>
        {pending ? <Spinner /> : restoring ? <RotateCcw aria-hidden="true" /> : <Archive aria-hidden="true" />}
      </Button>
      {state.status === "error" || state.status === "conflict" ? <span className="max-w-56 text-right text-xs text-destructive" role="alert">{state.message}</span> : null}
    </form>
  );

  return (
    <div className="grid justify-items-end gap-1">
      <AlertDialog>
        <AlertDialogTrigger render={<Button aria-label={`Arsipkan ${outlet.name}`} disabled={pending} size="icon" type="button" variant="ghost" />}>
          {pending ? <Spinner /> : <Archive aria-hidden="true" />}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arsipkan {outlet.name}?</AlertDialogTitle>
            <AlertDialogDescription>Outlet tidak tampil pada daftar aktif dan tidak dapat dipilih sebagai konteks kerja sampai dipulihkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <form action={action}>
              <input name="id" type="hidden" value={outlet.id} />
              <input name="expectedUpdatedAt" type="hidden" value={outlet.updatedAt} />
              <AlertDialogAction className="w-full" disabled={pending} type="submit" variant="destructive">Arsipkan outlet</AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.status === "error" || state.status === "conflict" ? <span className="max-w-56 text-right text-xs text-destructive" role="alert">{state.message}</span> : null}
    </div>
  );
}

export function OutletCodeMark({ code }: { code: string }) {
  return <span aria-hidden="true" className="grid size-12 place-items-center rounded-xl bg-accent font-mono text-xs font-bold text-accent-foreground"><Building2 className="size-5" /><span className="sr-only">{code}</span></span>;
}

function OutletField({ errors, label, name, ...props }: React.ComponentProps<typeof Input> & { errors?: string[]; label: string; name: string }) {
  const id = `outlet-${name}-${String(props.defaultValue ?? "new").replace(/\W/g, "-")}`;
  return <Field data-invalid={Boolean(errors)}><FieldLabel htmlFor={id}>{label}</FieldLabel><Input aria-invalid={Boolean(errors)} id={id} name={name} {...props} /><FieldError errors={toFieldErrors(errors)} /></Field>;
}

function timezoneLabel(timezone: string) {
  if (timezone === "Asia/Makassar") return "WITA · Asia/Makassar";
  if (timezone === "Asia/Jayapura") return "WIT · Asia/Jayapura";
  return "WIB · Asia/Jakarta";
}

function toFieldErrors(errors?: string[]) { return errors?.map((message) => ({ message })); }
