import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ChangePasswordForm } from "@/components/staff/change-password-form";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ganti Kata Sandi" };

export default async function ChangePasswordPage() {
  const session = await requireSession();
  if (!session.user.mustChangePassword) redirect("/select-outlet");
  return <div className="min-h-svh bg-background"><header className="border-b bg-card"><div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between px-5"><BrandMark compact /><div className="flex gap-2"><ThemeToggle /><SignOutButton /></div></div></header><main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-16" id="main-content"><section><span className="grid size-12 place-items-center rounded-xl bg-success text-success-foreground"><ShieldCheck /></span><p className="mt-6 font-mono text-xs font-semibold tracking-widest text-success uppercase">Langkah keamanan wajib</p><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Amankan akses Anda.</h1><p className="mt-3 max-w-md leading-7 text-muted-foreground">Kata sandi sementara hanya untuk masuk pertama. Buat kata sandi pribadi sebelum memilih outlet kerja.</p></section><Card className="border shadow-none"><CardHeader><CardTitle>Kata sandi baru</CardTitle><CardDescription>Akun: {session.user.email}</CardDescription></CardHeader><CardContent><ChangePasswordForm /></CardContent></Card></main></div>;
}
