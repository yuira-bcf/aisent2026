import { db } from "@/lib/db";
import {
  blendRequests,
  orderItems,
  orders,
  users,
} from "@kyarainnovate/db/schema";
import type { Role } from "@kyarainnovate/db/schema";
import type { OrderStatus } from "@kyarainnovate/db/schema";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// getUsers – Paginated user list with optional search & role filter
// ---------------------------------------------------------------------------

export async function getUsers(
  page: number,
  limit: number,
  search?: string,
  roleFilter?: Role,
) {
  const offset = (page - 1) * limit;

  const conditions = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(users.name, pattern), ilike(users.email, pattern)),
    );
  }

  if (roleFilter) {
    conditions.push(eq(users.role, roleFilter));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(users).where(where),
  ]);

  return { items, total };
}

// ---------------------------------------------------------------------------
// updateUserRole – Update a user's role
// ---------------------------------------------------------------------------

export async function updateUserRole(
  userId: string,
  role: Role,
): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// getAllOrders – Paginated order list with optional status filter (admin)
// ---------------------------------------------------------------------------

export async function getAllOrders(
  page: number,
  limit: number,
  statusFilter?: OrderStatus,
) {
  const offset = (page - 1) * limit;

  const where = statusFilter ? eq(orders.status, statusFilter) : undefined;

  const [items, [{ value: total }]] = await Promise.all([
    db.query.orders.findMany({
      where,
      with: {
        items: true,
        user: {
          columns: { name: true, email: true },
        },
      },
      orderBy: desc(orders.createdAt),
      limit,
      offset,
    }),
    db.select({ value: count() }).from(orders).where(where),
  ]);

  return { items, total };
}

// ---------------------------------------------------------------------------
// getDashboardStats – Aggregate stats for the admin dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
  );

  const notCancelled = sql`${orders.status} != 'CANCELLED'`;

  const [
    [{ value: totalUsers }],
    [{ value: totalOrders }],
    [{ value: totalRevenue }],
    [{ value: totalBlends }],
    usersByRoleRows,
    [{ value: thisMonthRevenue }],
    [{ value: lastMonthRevenue }],
    [{ value: thisMonthOrders }],
    [{ value: lastMonthOrders }],
    [{ value: thisMonthBlends }],
    [{ value: lastMonthBlends }],
    [{ value: newUsersThisMonth }],
    monthlySalesRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(orders),
    db
      .select({
        value: sql<number>`coalesce(sum(${orders.totalYen}), 0)`.mapWith(
          Number,
        ),
      })
      .from(orders)
      .where(notCancelled),
    db.select({ value: count() }).from(blendRequests),
    db
      .select({ role: users.role, count: count() })
      .from(users)
      .groupBy(users.role),
    // This month revenue
    db
      .select({
        value: sql<number>`coalesce(sum(${orders.totalYen}), 0)`.mapWith(
          Number,
        ),
      })
      .from(orders)
      .where(and(notCancelled, sql`${orders.createdAt} >= ${thisMonthStart}`)),
    // Last month revenue
    db
      .select({
        value: sql<number>`coalesce(sum(${orders.totalYen}), 0)`.mapWith(
          Number,
        ),
      })
      .from(orders)
      .where(
        and(
          notCancelled,
          sql`${orders.createdAt} >= ${lastMonthStart}`,
          sql`${orders.createdAt} <= ${lastMonthEnd}`,
        ),
      ),
    // This month orders
    db
      .select({ value: count() })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${thisMonthStart}`),
    // Last month orders
    db
      .select({ value: count() })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${lastMonthStart}`,
          sql`${orders.createdAt} <= ${lastMonthEnd}`,
        ),
      ),
    // This month blends
    db
      .select({ value: count() })
      .from(blendRequests)
      .where(sql`${blendRequests.createdAt} >= ${thisMonthStart}`),
    // Last month blends
    db
      .select({ value: count() })
      .from(blendRequests)
      .where(
        and(
          sql`${blendRequests.createdAt} >= ${lastMonthStart}`,
          sql`${blendRequests.createdAt} <= ${lastMonthEnd}`,
        ),
      ),
    // New users this month
    db
      .select({ value: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${thisMonthStart}`),
    // Monthly sales for last 6 months
    db
      .select({
        month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(${orders.totalYen}), 0)`.mapWith(
          Number,
        ),
      })
      .from(orders)
      .where(
        and(
          notCancelled,
          sql`${orders.createdAt} >= ${new Date(now.getFullYear(), now.getMonth() - 5, 1)}`,
        ),
      )
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`),
  ]);

  return {
    totalUsers,
    totalOrders,
    totalRevenue,
    totalBlends,
    usersByRole: usersByRoleRows.map((row) => ({
      role: row.role,
      count: row.count,
    })),
    thisMonthRevenue,
    lastMonthRevenue,
    thisMonthOrders,
    lastMonthOrders,
    thisMonthBlends,
    lastMonthBlends,
    newUsersThisMonth,
    monthlySales: monthlySalesRows,
  };
}
