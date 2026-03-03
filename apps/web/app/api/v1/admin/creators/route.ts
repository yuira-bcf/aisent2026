import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { creatorApplications } from "@kyarainnovate/db/schema";
import type { ApplicationStatus } from "@kyarainnovate/db/schema";
import { count, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/creators
 *
 * Admin only. List creator applications with optional status filter.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { page, limit, offset } = parsePagination(req);
  const status = req.nextUrl.searchParams.get(
    "status",
  ) as ApplicationStatus | null;

  const where = status ? eq(creatorApplications.status, status) : undefined;

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(creatorApplications)
      .where(where)
      .orderBy(desc(creatorApplications.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(creatorApplications).where(where),
  ]);

  return apiSuccess({
    applications: rows,
    pagination: paginationMeta(total, page, limit),
  });
});
