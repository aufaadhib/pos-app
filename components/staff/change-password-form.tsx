"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { changePasswordAction } from "@/app/change-password/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { initialStaffActionState } from "@/lib/staff/types";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initialStaffActionState);
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="grid gap-5">
      <FieldGroup>
        <PasswordField autoComplete="current-password" errors={state.fieldErrors?.currentPassword} label="Kata sandi sementara" name="currentPassword" visible={visible} />
        <PasswordField autoComplete="new-password" errors={state.fieldErrors?.newPassword} label="Kata sandi baru" name="newPassword" visible={visible} />
        <PasswordField autoComplete="new-password" errors={state.fieldErrors?.confirmPassword} label="Ulangi kata sandi baru" name="confirmPassword" visible={visible} />
      </FieldGroup>
      <Button className="justify-self-start" onClick={() => setVisible((value) => !value)} type="button" variant="ghost">
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      </Button>
      <FieldDescription>Gunakan minimal 12 karakter. Setelah disimpan, session lain akan dikeluarkan.</FieldDescription>
      {state.status === "error" && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <Button disabled={pending} size="lg" type="submit">{pending && <Spinner />}{pending ? "Mengamankan akun…" : "Simpan kata sandi baru"}</Button>
    </form>
  );
}

function PasswordField({ errors, label, name, visible, ...props }: React.ComponentProps<typeof Input> & { errors?: string[]; label: string; name: string; visible: boolean }) {
  return <Field data-invalid={Boolean(errors)}><FieldLabel htmlFor={name}>{label}</FieldLabel><div className="relative"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-invalid={Boolean(errors)} className="pl-10" id={name} minLength={name === "currentPassword" ? 8 : 12} name={name} type={visible ? "text" : "password"} {...props} /></div><FieldError errors={errors?.map((message) => ({ message }))} /></Field>;
}
