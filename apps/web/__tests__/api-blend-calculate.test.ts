import { POST } from "@/app/api/v1/blend/calculate/route";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/blend/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const emptyParams = { params: Promise.resolve({}) };

describe("POST /api/v1/blend/calculate", () => {
  it("returns calculated blend for valid input", async () => {
    const res = await POST(
      makeRequest({
        keywords: [{ keywordId: "kw1", weight: 5 }],
        rules: {
          kw1: [
            { flavorId: "f-top", weight: "1", noteType: "TOP" },
            { flavorId: "f-mid", weight: "1", noteType: "MIDDLE" },
            { flavorId: "f-last", weight: "1", noteType: "LAST" },
          ],
        },
        ratios: { topRatio: 50, middleRatio: 30, lastRatio: 20 },
      }),
      emptyParams,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.flavors).toHaveLength(3);

    const top = json.data.flavors.find(
      (f: { noteType: string }) => f.noteType === "TOP",
    );
    expect(top).toBeDefined();
    expect(Number(top.ratio)).toBeCloseTo(50, 0);

    const mid = json.data.flavors.find(
      (f: { noteType: string }) => f.noteType === "MIDDLE",
    );
    expect(Number(mid.ratio)).toBeCloseTo(30, 0);

    const last = json.data.flavors.find(
      (f: { noteType: string }) => f.noteType === "LAST",
    );
    expect(Number(last.ratio)).toBeCloseTo(20, 0);
  });

  it("returns validation error when keywords are empty", async () => {
    const res = await POST(
      makeRequest({
        keywords: [],
        rules: {},
        ratios: { topRatio: 50, middleRatio: 30, lastRatio: 20 },
      }),
      emptyParams,
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns validation error when ratios do not sum to 100", async () => {
    const res = await POST(
      makeRequest({
        keywords: [{ keywordId: "kw1", weight: 1 }],
        rules: {
          kw1: [{ flavorId: "f1", weight: "1", noteType: "TOP" }],
        },
        ratios: { topRatio: 50, middleRatio: 30, lastRatio: 10 },
      }),
      emptyParams,
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("handles multiple keywords with different rules", async () => {
    const res = await POST(
      makeRequest({
        keywords: [
          { keywordId: "kw1", weight: 3 },
          { keywordId: "kw2", weight: 1 },
        ],
        rules: {
          kw1: [{ flavorId: "f-a", weight: "2", noteType: "TOP" }],
          kw2: [{ flavorId: "f-b", weight: "1", noteType: "TOP" }],
        },
        ratios: { topRatio: 100, middleRatio: 0, lastRatio: 0 },
      }),
      emptyParams,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // kw1: f-a score = 2*3 = 6
    // kw2: f-b score = 1*1 = 1
    // Normalized: f-a = 6/7 ≈ 85.71%, f-b = 1/7 ≈ 14.29%
    const total = json.data.flavors.reduce(
      (sum: number, f: { ratio: string }) => sum + Number(f.ratio),
      0,
    );
    expect(total).toBeCloseTo(100, 0);
  });

  it("returns empty flavors when no rules match", async () => {
    const res = await POST(
      makeRequest({
        keywords: [{ keywordId: "kw1", weight: 1 }],
        rules: {
          "kw-other": [{ flavorId: "f1", weight: "1", noteType: "TOP" }],
        },
        ratios: { topRatio: 100, middleRatio: 0, lastRatio: 0 },
      }),
      emptyParams,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.flavors).toHaveLength(0);
  });

  it("requires no authentication (standalone)", async () => {
    // Simply calling the endpoint without any auth headers should work
    const res = await POST(
      makeRequest({
        keywords: [{ keywordId: "kw1", weight: 1 }],
        rules: {
          kw1: [{ flavorId: "f1", weight: "1", noteType: "TOP" }],
        },
        ratios: { topRatio: 100, middleRatio: 0, lastRatio: 0 },
      }),
      emptyParams,
    );

    expect(res.status).toBe(200);
  });
});
