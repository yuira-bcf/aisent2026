import { getEffectivePrice } from "@/lib/services/product-service";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// getEffectivePrice
// ---------------------------------------------------------------------------

describe("getEffectivePrice", () => {
  const baseVariant = {
    price: 5000,
    salePrice: null as number | null,
    saleStartAt: null as Date | null,
    saleEndAt: null as Date | null,
  };

  it("returns regular price when no sale", () => {
    expect(getEffectivePrice(baseVariant)).toBe(5000);
  });

  it("returns regular price when sale is null", () => {
    expect(getEffectivePrice({ ...baseVariant, salePrice: 3000 })).toBe(5000);
  });

  it("returns sale price within active sale period", () => {
    const now = new Date();
    const result = getEffectivePrice({
      ...baseVariant,
      salePrice: 3500,
      saleStartAt: new Date(now.getTime() - 86400000), // yesterday
      saleEndAt: new Date(now.getTime() + 86400000), // tomorrow
    });
    expect(result).toBe(3500);
  });

  it("returns regular price when sale period has ended", () => {
    const now = new Date();
    const result = getEffectivePrice({
      ...baseVariant,
      salePrice: 3500,
      saleStartAt: new Date(now.getTime() - 172800000), // 2 days ago
      saleEndAt: new Date(now.getTime() - 86400000), // yesterday
    });
    expect(result).toBe(5000);
  });

  it("returns regular price when sale period has not started", () => {
    const now = new Date();
    const result = getEffectivePrice({
      ...baseVariant,
      salePrice: 3500,
      saleStartAt: new Date(now.getTime() + 86400000), // tomorrow
      saleEndAt: new Date(now.getTime() + 172800000), // 2 days later
    });
    expect(result).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Note: Full CRUD tests require DB mocking which is complex.
// These tests cover the pure utility functions.
// ---------------------------------------------------------------------------
