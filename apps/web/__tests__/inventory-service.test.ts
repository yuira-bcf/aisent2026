import { getStockStatus } from "@/lib/services/inventory-service";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// getStockStatus
// ---------------------------------------------------------------------------

describe("getStockStatus", () => {
  it("returns IN_STOCK for stock > 10", () => {
    expect(getStockStatus(11)).toBe("IN_STOCK");
    expect(getStockStatus(100)).toBe("IN_STOCK");
    expect(getStockStatus(999)).toBe("IN_STOCK");
  });

  it("returns LOW_STOCK for stock 1-10", () => {
    expect(getStockStatus(1)).toBe("LOW_STOCK");
    expect(getStockStatus(5)).toBe("LOW_STOCK");
    expect(getStockStatus(10)).toBe("LOW_STOCK");
  });

  it("returns OUT_OF_STOCK for stock 0", () => {
    expect(getStockStatus(0)).toBe("OUT_OF_STOCK");
  });
});
