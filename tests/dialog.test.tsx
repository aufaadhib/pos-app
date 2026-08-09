import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

describe("Dialog content", () => {
  it("uses content height with a viewport limit on mobile", () => {
    render(<Dialog open><DialogContent><DialogHeader><DialogTitle>Dialog contoh</DialogTitle><DialogDescription>Isi dialog.</DialogDescription></DialogHeader></DialogContent></Dialog>);
    expect(screen.getByRole("dialog", { name: "Dialog contoh" })).toHaveClass("top-1/2", "max-h-[calc(100svh-1rem)]", "-translate-y-1/2");
    expect(screen.getByRole("dialog", { name: "Dialog contoh" })).not.toHaveClass("bottom-2");
  });
});
