import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

/** Keeps account controls visible while the outlet list streams. */
export default function SelectOutletLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh bg-background"><header className="border-b bg-card"><div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-3 px-5"><BrandMark compact className="[&>span:last-child]:hidden sm:[&>span:last-child]:block" /><div className="flex shrink-0 gap-2"><ThemeToggle className="[&_[data-slot=button]]:size-9 sm:[&_[data-slot=button]]:size-11" /><SignOutButton /></div></div></header>{children}</div>;
}
