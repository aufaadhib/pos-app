import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { WorkspaceSidebarPreference } from "@/components/workspace-sidebar-preference";

describe("workspace sidebar preference", () => {
  beforeEach(() => {
    document.cookie = "glutong_sidebar_collapsed=; Max-Age=0; Path=/";
  });

  it("uses the server preference and persists toggle changes", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSidebarPreference defaultChecked />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    expect(document.cookie).toContain("glutong_sidebar_collapsed=0");
  });
});
