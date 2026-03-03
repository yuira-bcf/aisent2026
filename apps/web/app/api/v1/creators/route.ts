import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { apiSuccess } from "@/lib/api/response";
import { getActiveCreators } from "@/lib/services/creator-profile-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/creators
 *
 * Public list of active creators with optional filters.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const { page, limit } = parsePagination(req);
  const specialty = req.nextUrl.searchParams.get("specialty") ?? undefined;
  const sortBy = req.nextUrl.searchParams.get("sortBy") as
    | "newest"
    | "rating"
    | "sales"
    | undefined;

  const { items, total } = await getActiveCreators(page, limit, {
    specialty,
    sortBy,
  });

  return apiSuccess({
    creators: items,
    pagination: paginationMeta(total, page, limit),
  });
});
