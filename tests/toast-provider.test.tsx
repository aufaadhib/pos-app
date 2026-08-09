import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/toast-provider";

const mocks = vi.hoisted(() => ({ renderToastContainer: vi.fn() }));

vi.mock("react-toastify", () => ({
  ToastContainer: (props: unknown) => {
    mocks.renderToastContainer(props);
    return <div data-testid="toast-container" />;
  },
}));

/** Stubs one stable media query result for responsive toast placement. */
function setCompactViewport(matches: boolean) {
  const media = { matches, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => media });
}

beforeEach(() => mocks.renderToastContainer.mockClear());
afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

describe("Toast provider", () => {
  it("places compact workspace notifications above mobile controls", async () => {
    setCompactViewport(true);
    render(<ToastProvider />);
    await waitFor(() => expect(mocks.renderToastContainer).toHaveBeenLastCalledWith(expect.objectContaining({
      position: "top-center",
      style: expect.objectContaining({ top: "calc(env(safe-area-inset-top) + 0.75rem)" }),
    })));
  });

  it("keeps desktop notifications at the bottom right", async () => {
    setCompactViewport(false);
    render(<ToastProvider />);
    await waitFor(() => expect(mocks.renderToastContainer).toHaveBeenLastCalledWith(expect.objectContaining({ position: "bottom-right" })));
  });
});
