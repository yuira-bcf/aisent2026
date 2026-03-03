import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { apiSuccess } from "@/lib/api/response";
import { getUsers } from "@/lib/services/admin-service";
import type { Role } from "@kyarainnovate/db/schema";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/users
 *
 * Admin only. List users with optional search and role filter.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { page, limit } = parsePagination(req);
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const roleParam = req.nextUrl.searchParams.get("role") as Role | null;

  const { items, total } = await getUsers(
    page,
    limit,
    search,
    roleParam ?? undefined,
  );

  return apiSuccess({
    users: items,
    pagination: paginationMeta(total, page, limit),
  });
});
