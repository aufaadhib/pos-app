"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, BookOpen, ChefHat, HandCoins, House, Menu, Palette, ReceiptText, Settings2, ShoppingBasket, Store, Users, WalletCards } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AppRole } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/workspace", label: "Beranda", route: "workspace", icon: House },
  { href: "/pos", label: "Kasir", route: "pos", icon: ShoppingBasket },
  { href: "/kitchen", label: "Dapur", route: "kitchen", icon: ChefHat },
  { href: "/shifts", label: "Shift", route: "shifts", icon: WalletCards },
  { href: "/transactions", label: "Transaksi", route: "transactions", icon: ReceiptText },
  { href: "/reports", label: "Laporan", route: "reports", icon: BarChart3 },
  { href: "/settlements", label: "Ojol & settlement", route: "settlements", icon: HandCoins },
  { href: "/catalog", label: "Katalog", route: "catalog", icon: BookOpen },
  { href: "/outlets", label: "Outlet", route: "outlets", icon: Store },
  { href: "/staff", label: "Staf", route: "staff", icon: Users },
  { href: "/settings", label: "Pengaturan", route: "settings", icon: Settings2 },
  { href: "/design-system", label: "Sistem UI", route: "design-system", icon: Palette },
] as const;

const primaryMobileRoutes = new Set<string>(["workspace", "pos", "kitchen", "shifts"]);

type WorkspaceNavigationProps = {
  canManageStaff: boolean;
  canViewDesignSystem: boolean;
  mobile?: boolean;
  role: AppRole;
};

/** Keeps route highlighting reactive while the authenticated workspace shell remains mounted. */
export function WorkspaceNavigation({ canManageStaff, canViewDesignSystem, mobile = false, role }: WorkspaceNavigationProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navigationItems.filter((item) => {
    if (item.route === "reports" || item.route === "settlements" || item.route === "settings") return role !== "cashier";
    if (item.route === "staff") return canManageStaff;
    if (item.route === "design-system") return canViewDesignSystem;
    return true;
  });
  const visibleItems = mobile ? items.filter((item) => primaryMobileRoutes.has(item.route)) : items;
  const moreItems = mobile ? items.filter((item) => !primaryMobileRoutes.has(item.route)) : [];
  const moreActive = moreItems.some((item) => isActiveRoute(pathname, item.href));

  if (mobile) {
    return <><nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card/95 px-2 pt-1 pb-[calc(.4rem+env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden" style={{ gridTemplateColumns: `repeat(${visibleItems.length + 1}, minmax(0, 1fr))` }}>{visibleItems.map(({ href, icon: Icon, label }) => { const active = isActiveRoute(pathname, href); return <Link aria-current={active ? "page" : undefined} className={cn("relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.7rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", active && "bg-accent text-accent-foreground before:absolute before:top-0 before:h-1 before:w-8 before:rounded-b-full before:bg-primary")} href={href} key={href}><Icon aria-hidden="true" className="size-5" /><span className="truncate">{label}</span></Link>; })}<button aria-current={moreActive ? "page" : undefined} aria-expanded={moreOpen} aria-haspopup="dialog" aria-label="Lainnya" className={cn("relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.7rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", moreActive && "bg-accent text-accent-foreground before:absolute before:top-0 before:h-1 before:w-8 before:rounded-b-full before:bg-primary")} onClick={() => setMoreOpen(true)} type="button"><Menu aria-hidden="true" className="size-5" /><span className="truncate">Lainnya</span></button></nav>
      <Dialog onOpenChange={setMoreOpen} open={moreOpen}><DialogContent className="inset-x-3 top-auto bottom-[max(.75rem,env(safe-area-inset-bottom))] max-h-[calc(100svh-1.5rem)] translate-y-0 p-4 sm:inset-x-auto sm:top-auto sm:bottom-4 sm:left-1/2 sm:w-[min(42rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:translate-y-0 sm:p-5"><DialogHeader><DialogTitle>Menu lainnya</DialogTitle><DialogDescription>Buka area kerja lain sesuai akses akun Anda.</DialogDescription></DialogHeader><nav aria-label="Menu lainnya" className="grid grid-cols-2 gap-2 sm:grid-cols-3">{moreItems.map(({ href, icon: Icon, label }) => { const active = isActiveRoute(pathname, href); return <Link aria-current={active ? "page" : undefined} className={cn("flex min-h-16 min-w-0 items-center gap-3 rounded-xl border bg-background p-3 text-sm font-semibold leading-tight hover:border-primary hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", active && "border-primary bg-primary/5 text-primary")} href={href} key={href} onClick={() => setMoreOpen(false)}><Icon aria-hidden="true" className="size-5 shrink-0" /><span className="min-w-0">{label}</span></Link>; })}</nav></DialogContent></Dialog>
    </>;
  }

  return <nav aria-label="Navigasi utama" className="workspace-sidebar-nav mt-6 grid min-h-0 flex-1 content-start gap-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pb-3">{visibleItems.map(({ href, icon: Icon, label }) => { const active = isActiveRoute(pathname, href); return <Link aria-current={active ? "page" : undefined} aria-label={label} className={cn("relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", active && "bg-accent text-accent-foreground before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-r-full before:bg-primary")} href={href} key={href}><Icon aria-hidden="true" className="size-5" /><span className="workspace-sidebar-label">{label}</span></Link>; })}</nav>;
}

/** Matches a route root and its nested detail pages. */
function isActiveRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/workspace" && pathname.startsWith(`${href}/`));
}
