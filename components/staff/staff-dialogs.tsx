"use client";

import { useActionState, useState } from "react";
import { Copy, KeyRound, Pencil, Plus, Power, Printer, RotateCcw } from "lucide-react";

import {
  createStaffAction,
  deactivateStaffAction,
  reactivateStaffAction,
  resetStaffPasswordAction,
  updateStaffAction,
} from "@/app/staff/actions";
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
import type { AppRole } from "@/lib/auth/permissions";
import type { StaffItem, StaffOutletOption, TemporaryCredentials } from "@/lib/staff/types";
import { initialStaffActionState } from "@/lib/staff/types";

export function StaffFormDialog({
  actorRole,
  outlets,
  staff,
}: {
  actorRole: AppRole;
  outlets: StaffOutletOption[];
  staff?: StaffItem;
}) {
  const isEditing = Boolean(staff);
  const { state, action, pending, open, setOpen } = useAutoCloseDialogAction(
    isEditing ? updateStaffAction : createStaffAction,
    initialStaffActionState,
    isEditing,
  );
  const defaultRole = staff?.role === "manager" ? "manager" : "cashier";

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size={isEditing ? "icon" : "default"} variant={isEditing ? "ghost" : "default"} />}>
        {isEditing ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        <span className={isEditing ? "sr-only" : undefined}>{isEditing ? `Edit ${staff?.name}` : "Staf baru"}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit penugasan staf" : "Tambahkan staf"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Perubahan role dan outlet berlaku pada akses berikutnya." : "Sistem membuat kata sandi sementara yang hanya ditampilkan sekali."}
          </DialogDescription>
        </DialogHeader>
        {state.credentials ? <CredentialSlip credentials={state.credentials} /> : (
          <form action={action} className="grid gap-5">
            {staff && <><input name="id" type="hidden" value={staff.id} /><input name="expectedUpdatedAt" type="hidden" value={staff.updatedAt} /></>}
            <FieldGroup>
              <StaffField defaultValue={staff?.name} errors={state.fieldErrors?.name} label="Nama staf" maxLength={80} name="name" placeholder="Nama lengkap" />
              {!staff && <StaffField autoComplete="off" errors={state.fieldErrors?.email} label="Email login" maxLength={160} name="email" placeholder="staf@glutong.id" type="email" />}
              <Field data-invalid={Boolean(state.fieldErrors?.role)}>
                <FieldLabel htmlFor={`staff-role-${staff?.id ?? "new"}`}>Peran</FieldLabel>
                <SearchableSelect defaultValue={defaultRole} id={`staff-role-${staff?.id ?? "new"}`} name="role" options={[...(actorRole === "owner" ? [{ label: "Manajer", value: "manager" }] : []), { label: "Kasir", value: "cashier" }]} placeholder="Cari peran" />
                <FieldError errors={toFieldErrors(state.fieldErrors?.role)} />
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.outletIds)}>
                <FieldLabel>Penugasan outlet</FieldLabel>
                <div className="grid gap-2 rounded-xl border bg-muted/25 p-3 sm:grid-cols-2">
                  {outlets.map((outlet) => (
                    <label className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted" key={outlet.id}>
                      <Checkbox defaultChecked={staff?.outlets.some((item) => item.id === outlet.id)} name="outletIds" value={outlet.id} />
                      <span className="min-w-0"><span className="block font-semibold">{outlet.name}</span><span className="font-mono text-xs text-muted-foreground">{outlet.code}</span></span>
                    </label>
                  ))}
                  {outlets.length === 0 && <p className="p-2 text-sm text-muted-foreground">Belum ada outlet aktif yang dapat ditugaskan.</p>}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">Kasir wajib memiliki tepat satu outlet; manajer dapat memiliki beberapa outlet.</p>
                <FieldError errors={toFieldErrors(state.fieldErrors?.outletIds)} />
              </Field>
            </FieldGroup>
            {state.status !== "idle" && state.status !== "success" && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
            <DialogFooter><Button disabled={pending || outlets.length === 0} type="submit">{pending && <Spinner />}{pending ? "Menyimpan…" : isEditing ? "Simpan penugasan" : "Buat staf"}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StaffAccountActions({ staff }: { staff: StaffItem }) {
  const statusAction = staff.banned ? reactivateStaffAction : deactivateStaffAction;
  const [statusState, statusFormAction, statusPending] = useActionState(statusAction, initialStaffActionState);
  const [passwordState, passwordAction, passwordPending] = useActionState(resetStaffPasswordAction, initialStaffActionState);
  return (
    <div className="grid gap-2 sm:flex sm:justify-end">
      <AlertDialog>
        <AlertDialogTrigger render={<Button aria-label={`Reset kata sandi ${staff.name}`} disabled={passwordPending} size="icon" type="button" variant="ghost" />}>
          {passwordPending ? <Spinner /> : <KeyRound aria-hidden="true" />}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reset kata sandi {staff.name}?</AlertDialogTitle><AlertDialogDescription>Seluruh sesi staf akan dicabut. Sistem membuat kata sandi sementara baru yang hanya ditampilkan sekali.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><form action={passwordAction}><input name="id" type="hidden" value={staff.id} /><input name="expectedUpdatedAt" type="hidden" value={staff.updatedAt} /><AlertDialogAction className="w-full" disabled={passwordPending} type="submit" variant="destructive">Reset kata sandi</AlertDialogAction></form></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {staff.banned ? (
        <form action={statusFormAction}>
          <input name="id" type="hidden" value={staff.id} /><input name="expectedUpdatedAt" type="hidden" value={staff.updatedAt} />
          <Button aria-label={`Aktifkan ${staff.name}`} disabled={statusPending} size="icon" type="submit" variant="outline">{statusPending ? <Spinner /> : <RotateCcw aria-hidden="true" />}</Button>
        </form>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger render={<Button aria-label={`Nonaktifkan ${staff.name}`} disabled={statusPending} size="icon" type="button" variant="destructive" />}>
            {statusPending ? <Spinner /> : <Power aria-hidden="true" />}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Nonaktifkan {staff.name}?</AlertDialogTitle><AlertDialogDescription>Staf langsung kehilangan akses dan seluruh sesi aktif akan dicabut.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><form action={statusFormAction}><input name="id" type="hidden" value={staff.id} /><input name="expectedUpdatedAt" type="hidden" value={staff.updatedAt} /><AlertDialogAction className="w-full" disabled={statusPending} type="submit" variant="destructive">Nonaktifkan staf</AlertDialogAction></form></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {passwordState.credentials && <CredentialDialog credentials={passwordState.credentials} />}
      {(statusState.status === "error" || passwordState.status === "error") && <span className="text-xs text-destructive" role="alert">{statusState.message || passwordState.message}</span>}
    </div>
  );
}

function CredentialDialog({ credentials }: { credentials: TemporaryCredentials }) {
  return <Dialog defaultOpen><DialogContent><DialogHeader><DialogTitle>Kata sandi sementara</DialogTitle><DialogDescription>Informasi ini hanya tampil pada respons ini. Cetak atau salin sebelum menutup.</DialogDescription></DialogHeader><CredentialSlip credentials={credentials} /></DialogContent></Dialog>;
}

function CredentialSlip({ credentials }: { credentials: TemporaryCredentials }) {
  const [copied, setCopied] = useState(false);
  const content = `Glutong POS\nNama: ${credentials.name}\nEmail: ${credentials.email}\nKata sandi sementara: ${credentials.password}\nGanti kata sandi saat pertama masuk.`;
  async function handleCopyCredentials() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
  }
  function handlePrintCredentials() { window.print(); }
  return (
    <section className="credential-slip rounded-xl border-2 border-dashed border-primary/60 bg-accent/35 p-5" aria-label="Kredensial sementara">
      <p className="font-mono text-xs font-bold tracking-widest uppercase">Akses awal · Glutong POS</p>
      <dl className="mt-5 grid gap-3 text-sm">
        <div><dt className="text-muted-foreground">Nama</dt><dd className="font-semibold">{credentials.name}</dd></div>
        <div><dt className="text-muted-foreground">Email</dt><dd className="font-mono font-semibold break-all">{credentials.email}</dd></div>
        <div><dt className="text-muted-foreground">Kata sandi sementara</dt><dd className="mt-1 rounded-lg bg-background px-3 py-2 font-mono text-base font-bold break-all">{credentials.password}</dd></div>
      </dl>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Staf wajib mengganti kata sandi setelah login pertama. Jangan menyimpan salinan digital lebih lama dari yang diperlukan.</p>
      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => void handleCopyCredentials()} type="button" variant="outline"><Copy aria-hidden="true" />{copied ? "Sudah disalin" : "Salin"}</Button>
        <Button onClick={handlePrintCredentials} type="button"><Printer aria-hidden="true" />Cetak slip</Button>
      </div>
    </section>
  );
}

function StaffField({ errors, label, name, ...props }: React.ComponentProps<typeof Input> & { errors?: string[]; label: string; name: string }) {
  const id = `staff-${name}-${String(props.defaultValue ?? "new").replace(/\W/g, "-")}`;
  return <Field data-invalid={Boolean(errors)}><FieldLabel htmlFor={id}>{label}</FieldLabel><Input aria-invalid={Boolean(errors)} id={id} name={name} {...props} /><FieldError errors={toFieldErrors(errors)} /></Field>;
}

function toFieldErrors(errors?: string[]) { return errors?.map((message) => ({ message })); }
