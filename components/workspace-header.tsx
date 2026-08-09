import Link from "next/link";
import { cookies } from "next/headers";
import { MapPin, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { WorkspaceSidebarPreference } from "@/components/workspace-sidebar-preference";
import { roleLabels, type AppRole } from "@/lib/auth/permissions";
import { getCurrentSession } from "@/lib/auth/session";
import { formatOutletAddress } from "@/lib/outlets/normalization";
import { getActiveOutlet } from "@/lib/outlets/queries";
import { hasCurrentCashShift } from "@/lib/shifts/queries";

type WorkspaceHeaderProps = {
  canViewDesignSystem?: boolean;
  canManageStaff?: boolean;
  activeOutletId?: string | null;
  role: AppRole;
};

export async function WorkspaceHeader({
  canViewDesignSystem = false,
  canManageStaff = false,
  activeOutletId,
  role,
}: WorkspaceHeaderProps) {
  const storedSidebarState = (await cookies()).get("glutong_sidebar_collapsed")?.value;
  const session = await getCurrentSession();
  const [hasOpenShift, activeOutlet] = await Promise.all([
    session ? hasCurrentCashShift(session.user.id) : Promise.resolve(false),
    session ? getActiveOutlet(activeOutletId, session.user.id, role) : Promise.resolve(null),
  ]);
  const sidebarCollapsed = storedSidebarState === "1";
  const activeOutletLocation = activeOutlet ? formatOutletAddress(activeOutlet) : null;
  const outletLinkLabel = activeOutlet
    ? `Ganti outlet aktif. Saat ini ${activeOutlet.name}, ${activeOutletLocation}.`
    : "Pilih outlet aktif";

  return (
    <>
      <WorkspaceSidebarPreference defaultChecked={sidebarCollapsed} />
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b bg-card/95 px-3 backdrop-blur-sm lg:hidden">
        <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&>div>span:last-child]:hidden sm:[&>div>span:last-child]:block" href="/workspace">
          <BrandMark compact className="gap-2" />
        </Link>
        <div className="flex items-center gap-1">
          <Link aria-label={outletLinkLabel} className="flex size-11 shrink-0 items-center justify-center gap-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none md:h-11 md:w-auto md:max-w-48 md:px-3" href="/select-outlet" title={activeOutlet ? `${activeOutlet.name} · ${activeOutletLocation}` : undefined}><MapPin aria-hidden="true" className="size-5 shrink-0" /><span className="hidden min-w-0 text-left md:block"><span className="block text-[0.65rem] leading-none text-muted-foreground">{activeOutlet ? "Outlet aktif" : "Belum ada outlet"}</span><span className="mt-1 block truncate text-xs font-semibold text-foreground">{activeOutlet?.name ?? "Pilih outlet"}</span></span></Link>
          <FullscreenToggle compact />
          <ThemeToggle className="[&_[data-slot=button]]:size-9" />
          <SignOutButton hasOpenShift={hasOpenShift} />
        </div>
      </header>

      <aside className="workspace-sidebar fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-hidden border-r bg-card transition-[width] duration-200 lg:flex">
        <div className="workspace-sidebar-brand mx-3 mt-4 flex min-h-12 shrink-0 items-center justify-between gap-2">
          <Link aria-label="Buka beranda" className="min-w-0 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/workspace"><BrandMark compact /></Link>
          <label aria-label="Tampilkan atau sembunyikan sidebar" className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-within:ring-3 focus-within:ring-ring/40" htmlFor="workspace-sidebar-toggle" title="Tampilkan atau sembunyikan sidebar">
            <PanelLeftClose aria-hidden="true" className="workspace-sidebar-toggle-close size-5" />
            <PanelLeftOpen aria-hidden="true" className="workspace-sidebar-toggle-open hidden size-5" />
          </label>
        </div>
        <Link aria-label={outletLinkLabel} className="workspace-sidebar-outlet mx-3 mt-6 flex min-h-16 shrink-0 items-center gap-3 rounded-xl border bg-background px-3 py-2 text-sm hover:border-primary/60 hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/select-outlet" title={activeOutlet ? `${activeOutlet.name} · ${activeOutletLocation}` : undefined}>
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><MapPin aria-hidden="true" className="size-4" /></span>
          <span className="workspace-sidebar-label min-w-0 flex-1 overflow-hidden"><span className="block text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">{activeOutlet ? "Outlet aktif" : "Belum ada outlet"}</span><span className="block truncate font-semibold text-foreground">{activeOutlet?.name ?? "Pilih outlet"}</span>{activeOutletLocation && <span className="mt-0.5 block truncate text-[0.65rem] text-muted-foreground">{activeOutletLocation}</span>}</span>
        </Link>
        <WorkspaceNavigation canManageStaff={canManageStaff} canViewDesignSystem={canViewDesignSystem} role={role} />
        <div className="workspace-sidebar-footer shrink-0 border-t p-3">
          <FullscreenToggle className="mb-2 w-full" />
          <ThemeToggle className="workspace-sidebar-theme w-full justify-center shadow-none" />
          <div className="workspace-sidebar-account mt-2 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2"><span className="workspace-sidebar-label text-xs font-medium text-muted-foreground">{roleLabels[role]}</span><SignOutButton hasOpenShift={hasOpenShift} /></div>
        </div>
      </aside>

      <WorkspaceNavigation canManageStaff={canManageStaff} canViewDesignSystem={canViewDesignSystem} mobile role={role} />
    </>
  );
}
