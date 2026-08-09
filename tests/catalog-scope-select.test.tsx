import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OutletItem } from "@/lib/outlets/types";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/app/catalog/advanced-actions", () => ({
  changeAdvancedCatalogStatusAction: vi.fn(),
  saveModifierGroupAction: vi.fn(),
  saveModifierOptionAction: vi.fn(),
  saveOutletProductOverrideAction: vi.fn(),
  saveOutletVariantOverrideAction: vi.fn(),
  saveProductModifierAction: vi.fn(),
  saveVariantGroupAction: vi.fn(),
  saveVariantOptionAction: vi.fn(),
}));
vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({ "aria-label": ariaLabel, disabled, onValueChange, options, value }: { "aria-label"?: string; disabled?: boolean; onValueChange?: (value: string) => void; options: Array<{ label: string; value: string }>; value?: string }) => <select aria-label={ariaLabel} disabled={disabled} onChange={(event) => onValueChange?.(event.target.value)} value={value}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}));

import { CatalogScopeSelect } from "@/components/catalog/advanced-catalog";

const outlets = [
  { id: "outlet-1", code: "GLU-BAN", name: "Glutong Banyuwangi", timezone: "Asia/Jakarta", addressLine: null, provinceCode: "35", provinceName: "Jawa Timur", cityCode: "3510", cityName: "Kabupaten Banyuwangi", taxRate: "0.00", serviceChargeRate: "0.00", pricesIncludeTax: false, status: "ACTIVE", staffCount: 1, updatedAt: "2026-08-09T00:00:00.000Z" },
  { id: "outlet-2", code: "GLU-JAJ", name: "Glutong Jajag", timezone: "Asia/Jakarta", addressLine: null, provinceCode: "35", provinceName: "Jawa Timur", cityCode: "3510", cityName: "Kabupaten Banyuwangi", taxRate: "0.00", serviceChargeRate: "0.00", pricesIncludeTax: false, status: "ACTIVE", staffCount: 0, updatedAt: "2026-08-09T00:00:00.000Z" },
] satisfies OutletItem[];

describe("catalog scope select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.push.mockImplementation(() => new Promise(() => undefined));
  });

  it("shows the chosen outlet immediately while navigation is pending", async () => {
    const user = userEvent.setup();
    render(<CatalogScopeSelect outlets={outlets} value="outlet-1" />);

    const select = screen.getByRole("combobox", { name: "Cakupan katalog" });
    await user.selectOptions(select, "outlet-2");

    expect(select).toHaveValue("outlet-2");
    expect(mocks.push).toHaveBeenCalledWith("/catalog?scope=outlet&outletId=outlet-2");
  });
});
