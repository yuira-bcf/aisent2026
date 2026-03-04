import { db } from "@/lib/db";
import { sendNotification } from "@/lib/services/notification-service";
import {
  creatorProfiles,
  orderItems,
  orders,
  platformSettings,
  products,
  royalties,
  signatureRecipes,
  users,
} from "@kyarainnovate/db/schema";
import { and, count, desc, eq, inArray, sql, sum } from "drizzle-orm";

const DEFAULT_ROYALTY_RATE = "0.1000"; // 10%

// ---------------------------------------------------------------------------
// getRoyaltyRate – Get configurable royalty rate from platform settings
// ---------------------------------------------------------------------------

async function getRoyaltyRate(): Promise<number> {
  const [setting] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, "royalty_rate_default"));

  return Number.parseFloat(setting?.value ?? DEFAULT_ROYALTY_RATE);
}

// ---------------------------------------------------------------------------
// calculateRoyalty – Create royalty records for a completed order
// ---------------------------------------------------------------------------

export async function calculateRoyalty(orderId: string): Promise<void> {
  const rate = await getRoyaltyRate();

  // Find order items linked to creator recipes via products
  const rows = await db
    .select({
      creatorId: signatureRecipes.creatorId,
      itemTotal:
        sql<number>`(${orderItems.priceYen} * ${orderItems.quantity})`.mapWith(
          Number,
        ),
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .innerJoin(signatureRecipes, eq(products.recipeId, signatureRecipes.id))
    .where(eq(orderItems.orderId, orderId));

  if (rows.length === 0) return;

  // Group by creator
  const creatorTotals = new Map<string, number>();
  for (const row of rows) {
    const prev = creatorTotals.get(row.creatorId) ?? 0;
    creatorTotals.set(row.creatorId, prev + row.itemTotal);
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Check for existing royalties for this order to avoid duplicates
  const [existing] = await db
    .select({ cnt: count() })
    .from(royalties)
    .where(eq(royalties.orderId, orderId));

  if (existing.cnt > 0) return;

  // Insert royalty records
  const values = Array.from(creatorTotals.entries()).map(
    ([creatorId, total]) => ({
      creatorId,
      orderId,
      amount: Math.floor(total * rate),
      rate: rate.toFixed(4),
      period,
      status: "PENDING" as const,
    }),
  );

  if (values.length > 0) {
    await db.insert(royalties).values(values);
  }
}

// ---------------------------------------------------------------------------
// getRoyaltiesForCreator – Creator's royalty history
// ---------------------------------------------------------------------------

export async function getRoyaltiesForCreator(
  creatorId: string,
  opts?: { period?: string; page?: number; limit?: number },
) {
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions = [eq(royalties.creatorId, creatorId)];
  if (opts?.period) {
    conditions.push(eq(royalties.period, opts.period));
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: royalties.id,
        orderId: royalties.orderId,
        amount: royalties.amount,
        rate: royalties.rate,
        status: royalties.status,
        period: royalties.period,
        paidAt: royalties.paidAt,
        createdAt: royalties.createdAt,
      })
      .from(royalties)
      .where(where)
      .orderBy(desc(royalties.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(royalties).where(where),
  ]);

  return { items, total };
}

// ---------------------------------------------------------------------------
// getRoyaltySummary – Admin: all creators' royalty summary by period
// ---------------------------------------------------------------------------

export async function getRoyaltySummary(period?: string) {
  const conditions = period ? [eq(royalties.period, period)] : [];

  const summary = await db
    .select({
      creatorId: royalties.creatorId,
      displayName: creatorProfiles.displayName,
      totalAmount: sql<number>`coalesce(sum(${royalties.amount}), 0)`.mapWith(
        Number,
      ),
      pendingAmount:
        sql<number>`coalesce(sum(case when ${royalties.status} = 'PENDING' then ${royalties.amount} else 0 end), 0)`.mapWith(
          Number,
        ),
      paidAmount:
        sql<number>`coalesce(sum(case when ${royalties.status} = 'PAID' then ${royalties.amount} else 0 end), 0)`.mapWith(
          Number,
        ),
      orderCount: sql<number>`count(distinct ${royalties.orderId})`.mapWith(
        Number,
      ),
    })
    .from(royalties)
    .innerJoin(creatorProfiles, eq(royalties.creatorId, creatorProfiles.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(royalties.creatorId, creatorProfiles.displayName)
    .orderBy(desc(sql`sum(${royalties.amount})`));

  // Totals
  const totals = summary.reduce(
    (acc, row) => ({
      totalAmount: acc.totalAmount + row.totalAmount,
      pendingAmount: acc.pendingAmount + row.pendingAmount,
      paidAmount: acc.paidAmount + row.paidAmount,
    }),
    { totalAmount: 0, pendingAmount: 0, paidAmount: 0 },
  );

  return { creators: summary, totals };
}

// ---------------------------------------------------------------------------
// markAsPaid – Admin: mark royalties as paid
// ---------------------------------------------------------------------------

export async function markAsPaid(royaltyIds: string[]): Promise<number> {
  if (royaltyIds.length === 0) return 0;

  const result = await db
    .update(royalties)
    .set({
      status: "PAID",
      paidAt: new Date(),
    })
    .where(
      and(inArray(royalties.id, royaltyIds), eq(royalties.status, "PENDING")),
    )
    .returning({
      id: royalties.id,
      creatorId: royalties.creatorId,
      amount: royalties.amount,
      period: royalties.period,
    });

  // Notify each affected creator
  const creatorPayments = new Map<string, { amount: number; period: string }>();
  for (const row of result) {
    const prev = creatorPayments.get(row.creatorId);
    creatorPayments.set(row.creatorId, {
      amount: (prev?.amount ?? 0) + row.amount,
      period: row.period,
    });
  }

  for (const [creatorId, payment] of creatorPayments) {
    sendNotification({
      userId: creatorId,
      type: "ROYALTY_PAID",
      title: "ロイヤリティが支払われました",
      body: `ロイヤリティの支払い（${payment.amount.toLocaleString()}円）が完了しました。`,
      data: { amount: payment.amount, period: payment.period },
    }).catch((err) =>
      console.error("[royalty-service] notification failed:", err),
    );
  }

  return result.length;
}

// ---------------------------------------------------------------------------
// markPeriodAsPaid – Admin: mark all pending royalties for a creator+period
// ---------------------------------------------------------------------------

export async function markPeriodAsPaid(
  creatorId: string,
  period: string,
): Promise<number> {
  const result = await db
    .update(royalties)
    .set({
      status: "PAID",
      paidAt: new Date(),
    })
    .where(
      and(
        eq(royalties.creatorId, creatorId),
        eq(royalties.period, period),
        eq(royalties.status, "PENDING"),
      ),
    )
    .returning({ id: royalties.id, amount: royalties.amount });

  if (result.length > 0) {
    const totalAmount = result.reduce((sum, row) => sum + row.amount, 0);
    sendNotification({
      userId: creatorId,
      type: "ROYALTY_PAID",
      title: "ロイヤリティが支払われました",
      body: `${period} のロイヤリティの支払い（${totalAmount.toLocaleString()}円）が完了しました。`,
      data: { amount: totalAmount, period },
    }).catch((err) =>
      console.error("[royalty-service] notification failed:", err),
    );
  }

  return result.length;
}

// ---------------------------------------------------------------------------
// getMonthlySales – Admin: monthly sales breakdown
// ---------------------------------------------------------------------------

export async function getMonthlySales(months = 12) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);

  const data = await db
    .select({
      month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
      revenue: sql<number>`coalesce(sum(${orders.totalYen}), 0)`.mapWith(
        Number,
      ),
      orderCount: sql<number>`count(*)`.mapWith(Number),
      royaltyTotal: sql<number>`coalesce(sum(${royalties.amount}), 0)`.mapWith(
        Number,
      ),
    })
    .from(orders)
    .leftJoin(royalties, eq(orders.id, royalties.orderId))
    .where(
      and(
        sql`${orders.status} NOT IN ('CANCELLED', 'RETURNED')`,
        sql`${orders.createdAt} >= ${startDate}`,
      ),
    )
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`);

  return data;
}
