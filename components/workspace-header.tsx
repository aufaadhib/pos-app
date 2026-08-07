import Link from "next/link";
import { BookOpen, House, MapPin, Palette, ReceiptText, ShoppingBasket, Store, Users } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { roleLabels, type AppRole } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type WorkspaceHeaderProps = {
  canViewDesignSystem?: boolean;
  canManageStaff?: boolean;
  activeOutletId?: string | null;
  activeRoute?: "workspace" | "pos" | "transactions" | "catalog" | "outlets" | "staff" | "design-system";
  role: AppRole;
};

export function WorkspaceHeader({
  canViewDesignSystem = false,
  canManageStaff = false,
  activeOutletId,
  activeRoute = "workspace",
  role,
}: WorkspaceHeaderProps) {
  const navigationItems = [
    { href: "/workspace", label: "Beranda", route: "workspace", icon: House, visible: true },
    { href: "/pos", label: "Kasir", route: "pos", icon: ShoppingBasket, visible: true },
    { href: "/transactions", label: "Transaksi", route: "transactions", icon: ReceiptText, visible: true },
    { href: "/catalog", label: "Katalog", route: "catalog", icon: BookOpen, visible: true },
    { href: "/outlets", label: "Outlet", route: "outlets", icon: Store, visible: true },
    { href: "/staff", label: "Staf", route: "staff", icon: Users, visible: canManageStaff },
    { href: "/design-system", label: "Sistem UI", route: "design-system", icon: Palette, visible: canViewDesignSystem },
  ].filter((item) => item.visible);
  const mobileNavigationItems = navigationItems.filter((item) => ["workspace", "pos", "transactions", "catalog", "outlets"].includes(item.route));

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b bg-card/95 px-3 backdrop-blur-sm lg:hidden">
        <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&>div>span:last-child]:hidden sm:[&>div>span:last-child]:block" href="/workspace">
          <BrandMark compact className="gap-2" />
        </Link>
        <div className="flex items-center gap-1">
          <Link aria-label={activeOutletId ? "Ganti outlet aktif" : "Pilih outlet aktif"} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/select-outlet"><MapPin aria-hidden="true" className="size-5" /></Link>
          <ThemeToggle className="[&_[data-slot=button]]:size-9" />
          <SignOutButton />
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card lg:flex">
        <Link className="mx-4 mt-5 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/workspace"><BrandMark compact /></Link>
        <Link className="mx-3 mt-7 flex min-h-14 items-center gap-3 rounded-xl border bg-background px-3 text-sm hover:border-primary/60 hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/select-outlet">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><MapPin aria-hidden="true" className="size-4" /></span>
          <span className="min-w-0"><span className="block text-xs text-muted-foreground">Konteks layanan</span><span className="block truncate font-semibold">{activeOutletId ? "Outlet aktif" : "Pilih outlet"}</span></span>
        </Link>
        <nav aria-label="Navigasi utama" className="mt-6 grid gap-1 px-3">
          {navigationItems.map(({ href, icon: Icon, label, route }) => (
            <Link aria-current={activeRoute === route ? "page" : undefined} className={cn("relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", activeRoute === route && "bg-accent text-accent-foreground before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-r-full before:bg-primary")} href={href} key={href}><Icon aria-hidden="true" className="size-5" /><span>{label}</span></Link>
          ))}
        </nav>
        <div className="mt-auto border-t p-3">
          <ThemeToggle className="w-full justify-center shadow-none" />
          <div className="mt-2 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2"><span className="text-xs font-medium text-muted-foreground">{roleLabels[role]}</span><SignOutButton /></div>
        </div>
      </aside>

      <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card/95 px-2 pt-1 pb-[calc(.4rem+env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileNavigationItems.length}, minmax(0, 1fr))` }}>
        {mobileNavigationItems.map(({ href, icon: Icon, label, route }) => (
          <Link aria-current={activeRoute === route ? "page" : undefined} className={cn("relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.7rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", activeRoute === route && "bg-accent text-accent-foreground before:absolute before:top-0 before:h-1 before:w-8 before:rounded-b-full before:bg-primary")} href={href} key={href}><Icon aria-hidden="true" className="size-5" /><span className="truncate">{label}</span></Link>
        ))}
      </nav>
    </>
  );
}
