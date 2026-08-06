"use client";

import { type FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { signInSchema } from "@/lib/validation/sign-in";

type LoginErrors = {
  email?: string;
  password?: string;
  form?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const validation = signInSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!validation.success) {
      const fields = validation.error.flatten().fieldErrors;
      setErrors({
        email: fields.email?.[0],
        password: fields.password?.[0],
      });
      return;
    }

    setPending(true);

    try {
      const result = await authClient.signIn.email({
        email: validation.data.email,
        password: validation.data.password,
        rememberMe: true,
      });

      if (result.error) {
        setErrors({
          form: "Email atau kata sandi tidak sesuai. Periksa kembali lalu coba lagi.",
        });
        return;
      }

      router.replace("/workspace");
      router.refresh();
    } catch {
      setErrors({
        form: "Glutong POS belum dapat dihubungi. Periksa koneksi lalu coba lagi.",
      });
    } finally {
      setPending(false);
    }
  }

  function handlePasswordVisibility() {
    setShowPassword((visible) => !visible);
  }

  return (
    <form aria-label="Form masuk staf" noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        {errors.form && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Belum berhasil masuk</AlertTitle>
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={Boolean(errors.email)}
              autoComplete="username"
              autoFocus
              className="pl-10"
              disabled={pending}
              id="email"
              name="email"
              placeholder="nama@glutong.id"
              type="email"
            />
          </div>
          <FieldError id="email-error">{errors.email}</FieldError>
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
          <div className="relative">
            <LockKeyhole
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={Boolean(errors.password)}
              autoComplete="current-password"
              className="px-10"
              disabled={pending}
              id="password"
              minLength={8}
              name="password"
              placeholder="Minimal 8 karakter"
              type={showPassword ? "text" : "password"}
            />
            <Button
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              aria-pressed={showPassword}
              className="absolute top-0 right-0 size-12"
              disabled={pending}
              onClick={handlePasswordVisibility}
              size="icon"
              type="button"
              variant="ghost"
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          <FieldError id="password-error">{errors.password}</FieldError>
        </Field>

        <Button className="w-full" disabled={pending} size="lg" type="submit">
          {pending && <Spinner aria-hidden="true" />}
          {pending ? "Memeriksa akses…" : "Masuk"}
        </Button>

        <FieldDescription className="text-center">
          Lupa akses? Hubungi pemilik atau manajer outlet Anda.
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
