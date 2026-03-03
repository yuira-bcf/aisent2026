import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { apiSuccess } from "@/lib/api/response";
import { getAllOrders } from "@/lib/services/admin-service";
import type { OrderStatus } from "@kyarainnovate/db/schema";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/orders
 *
 * Admin only. List all orders with optional status filter.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { page, limit } = parsePagination(req);
  const statusParam = req.nextUrl.searchParams.get(
    "status",
  ) as OrderStatus | null;

  const { items, total } = await getAllOrders(
    page,
    limit,
    statusParam ?? undefined,
  );

  return apiSuccess({
    orders: items,
    pagination: paginationMeta(total, page, limit),
  });
});
