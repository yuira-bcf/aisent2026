import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckStatus = "ok" | "error";

type CheckResult = {
  status: CheckStatus;
  latency: number;
  error?: string;
};

type HealthResponse = {
  status: "ok" | "degraded" | "error";
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: CheckResult;
  };
};

const startTime = Date.now();

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      status: "ok",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

export async function GET() {
  const databaseCheck = await checkDatabase();

  const overallStatus: HealthResponse["status"] =
    databaseCheck.status === "ok" ? "ok" : "error";

  const response: HealthResponse = {
    status: overallStatus,
    version: process.env.npm_package_version ?? "0.1.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks: {
      database: databaseCheck,
    },
  };

  return NextResponse.json(
    { ok: overallStatus !== "error", data: response },
    { status: overallStatus === "error" ? 503 : 200 },
  );
}
