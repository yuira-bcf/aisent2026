import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, royalties } from "@kyarainnovate/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import RoyaltyView from "./royalty-view";

export default async function RoyaltiesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [profile] = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, session.user.id));

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          ロイヤリティ
        </h1>
        <p className="text-sm text-gray-400">
          クリエータープロフィールが見つかりません。
        </p>
      </div>
    );
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
    .where(eq(royalties.creatorId, session.user.id));

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
        eq(royalties.creatorId, session.user.id),
        sql`${royalties.period} >= ${sixMonthsPeriod}`,
      ),
    )
    .groupBy(royalties.period)
    .orderBy(desc(royalties.period));

  const data = {
    totalRoyalty: summary.totalRoyalty,
    pendingRoyalty: summary.pendingRoyalty,
    paidRoyalty: summary.paidRoyalty,
    currentMonthRoyalty: summary.currentMonthRoyalty,
    monthlyBreakdown,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          ロイヤリティ
        </h1>
        <p className="text-sm text-gray-400">収益レポート</p>
      </div>
      <RoyaltyView data={data} />
    </div>
  );
}
