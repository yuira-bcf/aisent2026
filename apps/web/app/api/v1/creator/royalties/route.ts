import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { getRoyaltiesForCreator } from "@/lib/services/royalty-service";
import { creatorProfiles, royalties } from "@kyarainnovate/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/creator/royalties
 *
 * Royalty summary for the authenticated creator (backed by the royalties table).
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  // Verify creator profile exists
  const [profile] = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, authResult.userId));

  if (!profile) {
    return apiSuccess({
      totalRoyalty: 0,
      pendingRoyalty: 0,
      paidRoyalty: 0,
      currentMonthRoyalty: 0,
      monthlyBreakdown: [],
      items: [],
    });
  }

  // Current period string (YYYY-MM)
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Aggregate summary from royalties table
  const [summary] = await db
    .select({
      totalRoyalty: sql<number>`coalesce(sum(${royalties.amount}), 0)`.mapWith(
        Number,
      ),
      pendingRoyalty:
        sql<number>`coalesce(sum(case when ${royalties.status} = 'PENDING' then ${royalties.amount} else 0 end), 0)`.mapWith(
          Number,
        ),
      paidRoyalty:
        sql<number>`coalesce(sum(case when ${royalties.status} = 'PAID' then ${royalties.amount} else 0 end), 0)`.mapWith(
          Number,
        ),
      currentMonthRoyalty:
        sql<number>`coalesce(sum(case when ${royalties.period} = ${currentPeriod} then ${royalties.amount} else 0 end), 0)`.mapWith(
          Number,
        ),
    })
    .from(royalties)
    .where(eq(royalties.creatorId, authResult.userId));

  // Monthly breakdown (past 6 months)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixMonthsPeriod = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

  const monthlyBreakdown = await db
    .select({
      month: royalties.period,
      revenue: sql<number>`coalesce(sum(${royalties.amount}), 0)`.mapWith(
        Number,
      ),
      orderCount: sql<number>`count(distinct ${royalties.orderId})`.mapWith(
        Number,
      ),
      status: sql<string>`
        case
          when count(*) filter (where ${royalties.status} = 'PENDING') > 0 then 'PENDING'
          else 'PAID'
        end`.as("status"),
    })
    .from(royalties)
    .where(
      and(
        eq(royalties.creatorId, authResult.userId),
        sql`${royalties.period} >= ${sixMonthsPeriod}`,
      ),
    )
    .groupBy(royalties.period)
    .orderBy(desc(royalties.period));

  // Paginated items via service function
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const period = url.searchParams.get("period") ?? undefined;

  const { items, total } = await getRoyaltiesForCreator(authResult.userId, {
    period,
    page,
    limit,
  });

  return apiSuccess({
    totalRoyalty: summary.totalRoyalty,
    pendingRoyalty: summary.pendingRoyalty,
    paidRoyalty: summary.paidRoyalty,
    currentMonthRoyalty: summary.currentMonthRoyalty,
    monthlyBreakdown,
    items,
    pagination: {
      page,
      limit,
      total,
    },
  });
});
