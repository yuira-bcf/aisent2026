import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import {
  creatorProfiles,
  orderItems,
  orders,
  products,
  signatureRecipes,
} from "@kyarainnovate/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

const ROYALTY_RATE = 0.1; // 10%

/**
 * GET /api/v1/creator/royalties
 *
 * Royalty summary for the authenticated creator.
 */
export const GET = safeHandler(async (_req: NextRequest) => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  // Verify creator profile exists
  const [profile] = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, authResult.userId));

  if (!profile) {
    return apiSuccess({
      totalRevenue: 0,
      currentMonthRevenue: 0,
      recipeCount: 0,
      recipeBreakdown: [],
      monthlyBreakdown: [],
    });
  }

  // Recipe breakdown: join signatureRecipes -> products -> orderItems -> orders
  const recipeBreakdown = await db
    .select({
      recipeId: signatureRecipes.id,
      recipeName: signatureRecipes.name,
      orderCount: sql<number>`COUNT(DISTINCT ${orders.id})`.as("order_count"),
      totalSales:
        sql<number>`COALESCE(SUM(${orderItems.priceYen} * ${orderItems.quantity}), 0)`.as(
          "total_sales",
        ),
    })
    .from(signatureRecipes)
    .leftJoin(products, eq(products.blendResultId, signatureRecipes.id))
    .leftJoin(orderItems, eq(orderItems.productId, products.id))
    .leftJoin(
      orders,
      and(
        eq(orderItems.orderId, orders.id),
        sql`${orders.status} NOT IN ('CANCELLED', 'RETURNED')`,
      ),
    )
    .where(eq(signatureRecipes.creatorId, authResult.userId))
    .groupBy(signatureRecipes.id, signatureRecipes.name)
    .orderBy(desc(sql`total_sales`));

  // Total revenue
  const totalRevenue = recipeBreakdown.reduce(
    (sum, r) => sum + Number(r.totalSales),
    0,
  );

  // Current month revenue
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [currentMonthRow] = await db
    .select({
      revenue:
        sql<number>`COALESCE(SUM(${orderItems.priceYen} * ${orderItems.quantity}), 0)`.as(
          "revenue",
        ),
    })
    .from(signatureRecipes)
    .leftJoin(products, eq(products.blendResultId, signatureRecipes.id))
    .leftJoin(orderItems, eq(orderItems.productId, products.id))
    .leftJoin(
      orders,
      and(
        eq(orderItems.orderId, orders.id),
        sql`${orders.status} NOT IN ('CANCELLED', 'RETURNED')`,
      ),
    )
    .where(
      and(
        eq(signatureRecipes.creatorId, authResult.userId),
        gte(orders.createdAt, monthStart),
      ),
    );

  const currentMonthRevenue = Number(currentMonthRow?.revenue ?? 0);

  // Monthly breakdown (past 6 months)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const monthlyBreakdown = await db
    .select({
      month: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`.as("month"),
      revenue:
        sql<number>`COALESCE(SUM(${orderItems.priceYen} * ${orderItems.quantity}), 0)`.as(
          "revenue",
        ),
      orderCount: sql<number>`COUNT(DISTINCT ${orders.id})`.as("order_count"),
    })
    .from(signatureRecipes)
    .innerJoin(products, eq(products.blendResultId, signatureRecipes.id))
    .innerJoin(orderItems, eq(orderItems.productId, products.id))
    .innerJoin(
      orders,
      and(
        eq(orderItems.orderId, orders.id),
        sql`${orders.status} NOT IN ('CANCELLED', 'RETURNED')`,
      ),
    )
    .where(
      and(
        eq(signatureRecipes.creatorId, authResult.userId),
        gte(orders.createdAt, sixMonthsAgo),
      ),
    )
    .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
    .orderBy(desc(sql`month`));

  // Recipe count
  const recipeCount = recipeBreakdown.length;

  return apiSuccess({
    totalRevenue: Math.floor(totalRevenue * ROYALTY_RATE),
    currentMonthRevenue: Math.floor(currentMonthRevenue * ROYALTY_RATE),
    recipeCount,
    recipeBreakdown: recipeBreakdown.map((r) => ({
      recipeId: r.recipeId,
      recipeName: r.recipeName,
      orderCount: Number(r.orderCount),
      totalSales: Number(r.totalSales),
      royalty: Math.floor(Number(r.totalSales) * ROYALTY_RATE),
    })),
    monthlyBreakdown: monthlyBreakdown.map((m) => ({
      month: m.month,
      revenue: Math.floor(Number(m.revenue) * ROYALTY_RATE),
      orderCount: Number(m.orderCount),
    })),
  });
});
