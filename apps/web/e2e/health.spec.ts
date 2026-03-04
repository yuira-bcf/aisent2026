import { expect, test } from "@playwright/test";

test.describe("Health checks", () => {
  test("GET /api/health returns 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
