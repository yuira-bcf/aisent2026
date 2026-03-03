import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  creatorProfiles,
  orderItems,
  orders,
  products,
  signatureRecipes,
} from "@kyarainnovate/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import RoyaltyView from "./royalty-view";

const ROYALTY_RATE = 0.1;

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

  // Recipe breakdown
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
    .where(eq(signatureRecipes.creatorId, session.user.id))
    .groupBy(signatureRecipes.id, signatureRecipes.name)
    .orderBy(desc(sql`total_sales`));

  const totalRevenue = recipeBreakdown.reduce(
    (sum, r) => sum + Number(r.totalSales),
    0,
  );

  // Current month
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
        eq(signatureRecipes.creatorId, session.user.id),
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
        eq(signatureRecipes.creatorId, session.user.id),
        gte(orders.createdAt, sixMonthsAgo),
      ),
    )
    .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
    .orderBy(desc(sql`month`));

  const data = {
    totalRevenue: Math.floor(totalRevenue * ROYALTY_RATE),
    currentMonthRevenue: Math.floor(currentMonthRevenue * ROYALTY_RATE),
    recipeCount: recipeBreakdown.length,
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
