import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { FullscreenToggle } from "@/components/fullscreen-toggle";

/** Configures the minimal browser capabilities needed to exercise the iPhone fallback. */
function configureIphoneBrowser({ standalone = false }: { standalone?: boolean } = {}) {
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" });
  Object.defineProperty(navigator, "standalone", { configurable: true, value: standalone });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: standalone }) });
}

afterEach(() => {
  Reflect.deleteProperty(document, "fullscreenEnabled");
  Reflect.deleteProperty(navigator, "standalone");
  Reflect.deleteProperty(navigator, "userAgent");
  Reflect.deleteProperty(window, "matchMedia");
});

describe("PWA fullscreen fallback", () => {
  it("exposes an installable standalone manifest", () => {
    expect(manifest()).toMatchObject({ display: "standalone", start_url: "/", theme_color: "#2C1D2B" });
  });

  it("guides unsupported iPhone users to install the app", async () => {
    configureIphoneBrowser();
    render(<FullscreenToggle />);

    await userEvent.click(await screen.findByRole("button", { name: "Pasang mode aplikasi" }));
    expect(screen.getByRole("dialog", { name: "Gunakan seperti aplikasi di iPhone" })).toBeVisible();
    expect(screen.getByText(/Tambahkan ke Layar Utama/)).toBeVisible();
  });

  it("recognizes an installed home-screen launch", async () => {
    configureIphoneBrowser({ standalone: true });
    render(<FullscreenToggle />);
    expect(await screen.findByRole("button", { name: "Mode aplikasi aktif" })).toBeDisabled();
  });
});
