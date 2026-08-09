import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { WorkspaceSidebarPreference } from "@/components/workspace-sidebar-preference";

const route = vi.hoisted(() => ({ pathname: "/workspace" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

describe("workspace navigation", () => {
  beforeEach(() => {
    route.pathname = "/workspace";
  });

  it("updates the active route without resetting the retained sidebar control", async () => {
    const user = userEvent.setup();
    const view = render(
      <>
        <WorkspaceSidebarPreference defaultChecked />
        <WorkspaceNavigation canManageStaff canViewDesignSystem role="owner" />
      </>,
    );

    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Beranda" })).toHaveAttribute("aria-current", "page");

    route.pathname = "/pos";
    view.rerender(
      <>
        <WorkspaceSidebarPreference defaultChecked />
        <WorkspaceNavigation canManageStaff canViewDesignSystem role="owner" />
      </>,
    );

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Kasir" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Beranda" })).not.toHaveAttribute("aria-current");
  });

  it("shows reports to managers but not cashiers", () => {
    const view = render(<WorkspaceNavigation canManageStaff canViewDesignSystem={false} role="manager" />);
    expect(screen.getByRole("link", { name: "Laporan" })).toBeVisible();

    view.rerender(<WorkspaceNavigation canManageStaff={false} canViewDesignSystem={false} role="cashier" />);
    expect(screen.queryByRole("link", { name: "Laporan" })).not.toBeInTheDocument();
  });
});
