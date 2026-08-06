import type { Metadata } from "next";

import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { ServiceTicketRail } from "@/components/service-ticket-rail";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke workspace Glutong POS.",
};

export default function SignInPage() {
  return (
    <main className="grid min-h-svh grid-rows-[auto_1fr] bg-background lg:grid-cols-[minmax(22rem,0.82fr)_minmax(32rem,1.18fr)] lg:grid-rows-none">
      <section className="relative overflow-hidden bg-brand-panel px-5 py-6 text-brand-panel-foreground sm:px-8 sm:py-8 lg:flex lg:min-h-svh lg:flex-col lg:justify-between lg:px-10 lg:py-10 xl:px-14 xl:py-12">
        <div className="service-entry">
          <BrandMark inverse />
          <div className="mt-8 hidden max-w-lg lg:block">
            <p className="font-mono text-xs font-semibold tracking-widest text-ticket uppercase">
              Service desk · siap digunakan
            </p>
            <h1 className="mt-4 max-w-md font-heading text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
              Mulai shift dengan tenang. Layani dengan sigap.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/70">
              Satu pintu masuk untuk tim kasir, manajer, dan pemilik Glutong.
            </p>
          </div>
        </div>

        <ServiceTicketRail />
      </section>

      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
        <ThemeToggle className="absolute top-4 right-4 sm:top-6 sm:right-6" />
        <div className="service-entry service-entry-delay w-full max-w-md pt-14 lg:pt-0">
          <div className="mb-8">
            <p className="font-mono text-xs font-semibold tracking-widest text-success uppercase">
              Akses staf
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Masuk ke Glutong POS
            </h2>
            <p className="mt-3 max-w-sm text-base leading-6 text-muted-foreground">
              Gunakan akun yang diberikan pemilik atau manajer outlet.
            </p>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
