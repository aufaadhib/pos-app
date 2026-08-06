import { Check, LogIn, Store, Utensils } from "lucide-react";

const serviceSteps = [
  { label: "Masuk", description: "Akun staf", icon: LogIn },
  { label: "Periksa", description: "Outlet & shift", icon: Store },
  { label: "Melayani", description: "Pesanan tamu", icon: Utensils },
] as const;

export function ServiceTicketRail() {
  return (
    <div className="service-entry service-entry-delay mt-8 rounded-xl border border-white/15 bg-white/5 p-4 lg:mt-12 lg:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs tracking-widest text-white/60 uppercase">
          Alur mulai layanan
        </span>
        <Check aria-hidden="true" className="size-4 text-ticket" />
      </div>
      <ol className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-0">
        {serviceSteps.map(({ label, description, icon: Icon }, index) => (
          <li
            key={label}
            className="relative flex min-w-0 flex-col items-center text-center lg:flex-row lg:gap-4 lg:pb-7 lg:text-left lg:last:pb-0"
          >
            <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-ticket/50 bg-brand-panel text-ticket lg:size-11">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            {index < serviceSteps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-5 left-[calc(50%+1.25rem)] h-px w-[calc(100%-2.5rem)] border-t border-dashed border-white/25 lg:top-11 lg:left-5 lg:h-7 lg:w-px lg:border-t-0 lg:border-l"
              />
            )}
            <span className="mt-2 min-w-0 lg:mt-0">
              <span className="block font-heading text-sm font-semibold text-white">
                {index + 1}. {label}
              </span>
              <span className="mt-0.5 hidden text-sm text-white/55 sm:block">
                {description}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
