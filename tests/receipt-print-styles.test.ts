import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("receipt print media", () => {
  it("maps 58 mm paper to a 52 mm content area", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/\.receipt-paper-mm58\s*{[^}]*width:\s*52mm;[^}]*page:\s*receipt-mm58;/s);
    expect(css).toMatch(/@page receipt-mm58\s*{[^}]*size:\s*58mm auto;[^}]*margin:\s*3mm;/s);
  });

  it("maps 80 mm paper to a 72 mm content area", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/\.receipt-paper-mm80\s*{[^}]*width:\s*72mm;[^}]*page:\s*receipt-mm80;/s);
    expect(css).toMatch(/@page receipt-mm80\s*{[^}]*size:\s*80mm auto;[^}]*margin:\s*4mm;/s);
  });
});
