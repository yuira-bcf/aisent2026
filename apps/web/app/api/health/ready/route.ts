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

type ReadinessResponse = {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  checks: Record<string, CheckResult>;
};

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

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();

  if (!process.env.REDIS_URL) {
    return {
      status: "ok",
      latency: 0,
      error: "REDIS_URL not configured (skipped)",
    };
  }

  try {
    // Dynamic import to avoid errors when ioredis is not installed
    const { default: Redis } = await import("ioredis");
    const client = new Redis(process.env.REDIS_URL, {
      connectTimeout: 2000,
      lazyConnect: true,
    });

    await client.connect();
    await client.ping();
    await client.quit();

    return {
      status: "ok",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown Redis error",
    };
  }
}

async function checkStripe(): Promise<CheckResult> {
  const start = Date.now();

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      status: "ok",
      latency: 0,
      error: "STRIPE_SECRET_KEY not configured (skipped)",
    };
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        status: "error",
        latency: Date.now() - start,
        error: `Stripe API returned ${response.status}`,
      };
    }

    return {
      status: "ok",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown Stripe error",
    };
  }
}

export async function GET() {
  const [databaseCheck, redisCheck, stripeCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStripe(),
  ]);

  const checks: Record<string, CheckResult> = {
    database: databaseCheck,
    redis: redisCheck,
    stripe: stripeCheck,
  };

  // Database is required; Redis and Stripe are optional
  const requiredFailed = databaseCheck.status === "error";
  const optionalFailed =
    redisCheck.status === "error" || stripeCheck.status === "error";

  let overallStatus: ReadinessResponse["status"];
  if (requiredFailed) {
    overallStatus = "error";
  } else if (optionalFailed) {
    overallStatus = "degraded";
  } else {
    overallStatus = "ok";
  }

  const response: ReadinessResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(
    { ok: overallStatus !== "error", data: response },
    { status: overallStatus === "error" ? 503 : 200 },
  );
}
