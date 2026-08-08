import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { WorkspaceSidebarPreference } from "@/components/workspace-sidebar-preference";

describe("workspace sidebar preference", () => {
  beforeEach(() => {
    document.cookie = "glutong_sidebar_collapsed=; Max-Age=0; Path=/";
  });

  it("restores the collapsed state after the control remounts", async () => {
    const user = userEvent.setup();
    const firstRender = render(<WorkspaceSidebarPreference defaultChecked={false} />);
    await user.click(screen.getByRole("checkbox"));
    expect(document.cookie).toContain("glutong_sidebar_collapsed=1");
    firstRender.unmount();

    render(<WorkspaceSidebarPreference defaultChecked={false} />);
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
  });
});
