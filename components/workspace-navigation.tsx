"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChefHat, HandCoins, House, Palette, ReceiptText, Settings2, ShoppingBasket, Store, Users, WalletCards } from "lucide-react";

import type { AppRole } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/workspace", label: "Beranda", route: "workspace", icon: House },
  { href: "/pos", label: "Kasir", route: "pos", icon: ShoppingBasket },
  { href: "/kitchen", label: "Dapur", route: "kitchen", icon: ChefHat },
  { href: "/shifts", label: "Shift", route: "shifts", icon: WalletCards },
  { href: "/transactions", label: "Transaksi", route: "transactions", icon: ReceiptText },
  { href: "/settlements", label: "Ojol & settlement", route: "settlements", icon: HandCoins },
  { href: "/catalog", label: "Katalog", route: "catalog", icon: BookOpen },
  { href: "/outlets", label: "Outlet", route: "outlets", icon: Store },
  { href: "/staff", label: "Staf", route: "staff", icon: Users },
  { href: "/settings", label: "Pengaturan", route: "settings", icon: Settings2 },
  { href: "/design-system", label: "Sistem UI", route: "design-system", icon: Palette },
] as const;

type WorkspaceNavigationProps = {
  canManageStaff: boolean;
  canViewDesignSystem: boolean;
  mobile?: boolean;
  role: AppRole;
};

/** Keeps route highlighting reactive while the authenticated workspace shell remains mounted. */
export function WorkspaceNavigation({ canManageStaff, canViewDesignSystem, mobile = false, role }: WorkspaceNavigationProps) {
  const pathname = usePathname();
  const items = navigationItems.filter((item) => {
    if (item.route === "settlements" || item.route === "settings") return role !== "cashier";
    if (item.route === "staff") return canManageStaff;
    if (item.route === "design-system") return canViewDesignSystem;
    return true;
  });
  const visibleItems = mobile ? items.filter((item) => ["workspace", "pos", "kitchen", "shifts", "transactions"].includes(item.route)) : items;

  if (mobile) {
    return <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card/95 px-2 pt-1 pb-[calc(.4rem+env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>{visibleItems.map(({ href, icon: Icon, label }) => { const active = isActiveRoute(pathname, href); return <Link aria-current={active ? "page" : undefined} className={cn("relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.7rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", active && "bg-accent text-accent-foreground before:absolute before:top-0 before:h-1 before:w-8 before:rounded-b-full before:bg-primary")} href={href} key={href}><Icon aria-hidden="true" className="size-5" /><span className="truncate">{label}</span></Link>; })}</nav>;
  }

  return <nav aria-label="Navigasi utama" className="workspace-sidebar-nav mt-6 grid min-h-0 flex-1 content-start gap-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pb-3">{visibleItems.map(({ href, icon: Icon, label }) => { const active = isActiveRoute(pathname, href); return <Link aria-current={active ? "page" : undefined} aria-label={label} className={cn("relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none", active && "bg-accent text-accent-foreground before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-r-full before:bg-primary")} href={href} key={href}><Icon aria-hidden="true" className="size-5" /><span className="workspace-sidebar-label">{label}</span></Link>; })}</nav>;
}

/** Matches a route root and its nested detail pages. */
function isActiveRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/workspace" && pathname.startsWith(`${href}/`));
}
