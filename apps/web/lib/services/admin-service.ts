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
  const [
    [{ value: totalUsers }],
    [{ value: totalOrders }],
    [{ value: totalRevenue }],
    [{ value: totalBlends }],
    usersByRoleRows,
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
      .where(sql`${orders.status} != 'CANCELLED'`),
    db.select({ value: count() }).from(blendRequests),
    db
      .select({
        role: users.role,
        count: count(),
      })
      .from(users)
      .groupBy(users.role),
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
  };
}
