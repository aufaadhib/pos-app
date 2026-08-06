import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

type WorkspaceHeaderProps = {
  canViewDesignSystem?: boolean;
};

export function WorkspaceHeader({
  canViewDesignSystem = false,
}: WorkspaceHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
        <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/workspace">
          <BrandMark compact />
        </Link>
        <nav aria-label="Navigasi akun" className="flex items-center gap-2">
          {canViewDesignSystem && (
            <Link
              className="hidden min-h-12 items-center rounded-lg px-3 text-sm font-semibold hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:flex"
              href="/design-system"
            >
              Design system
            </Link>
          )}
          <ThemeToggle />
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
