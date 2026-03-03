import type { NextRequest } from "next/server";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(req: NextRequest) {
  const url = req.nextUrl;
  const page = Math.max(
    1,
    Number(url.searchParams.get("page")) || DEFAULT_PAGE,
  );
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
  );

  return { page, limit, offset: (page - 1) * limit };
}

export function paginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
