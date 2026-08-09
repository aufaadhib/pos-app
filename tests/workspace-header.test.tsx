import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveOutlet: vi.fn(),
  getCurrentSession: vi.fn(),
  hasCurrentCashShift: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/lib/outlets/queries", () => ({ getActiveOutlet: mocks.getActiveOutlet }));
vi.mock("@/lib/shifts/queries", () => ({ hasCurrentCashShift: mocks.hasCurrentCashShift }));
vi.mock("@/components/brand-mark", () => ({ BrandMark: () => <span>Glutong</span> }));
vi.mock("@/components/fullscreen-toggle", () => ({ FullscreenToggle: () => <button type="button">Layar penuh</button> }));
vi.mock("@/components/sign-out-button", () => ({ SignOutButton: () => <button type="button">Keluar</button> }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => <button type="button">Tema</button> }));
vi.mock("@/components/workspace-navigation", () => ({ WorkspaceNavigation: () => <nav>Navigasi</nav> }));
vi.mock("@/components/workspace-sidebar-preference", () => ({ WorkspaceSidebarPreference: () => null }));

import { WorkspaceHeader } from "@/components/workspace-header";

describe("WorkspaceHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.hasCurrentCashShift.mockResolvedValue(false);
    mocks.getActiveOutlet.mockResolvedValue({
      id: "outlet-1",
      code: "GLU-JAJ",
      name: "Glutong Jajag",
      timezone: "Asia/Jakarta",
      addressLine: "Jl. Raya Jajag",
      cityName: "Kabupaten Banyuwangi",
      provinceName: "Jawa Timur",
    });
  });

  it("shows the active outlet name and location in the workspace shell", async () => {
    render(await WorkspaceHeader({ activeOutletId: "outlet-1", role: "owner" }));

    expect(screen.getAllByText("Glutong Jajag")).toHaveLength(2);
    expect(screen.getByText("Jl. Raya Jajag, Kabupaten Banyuwangi, Jawa Timur")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Saat ini Glutong Jajag/ })).toHaveLength(2);
  });
});
