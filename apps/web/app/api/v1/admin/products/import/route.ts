import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { importProductsCSV } from "@/lib/services/csv-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/admin/products/import
 *
 * Admin only. Upload CSV to update products and variants.
 * Expects multipart/form-data with a "file" field.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return VALIDATION_ERROR("CSVファイルを指定してください");
  }

  if (!file.name.endsWith(".csv")) {
    return VALIDATION_ERROR("CSVファイルのみ対応しています");
  }

  const csvText = await file.text();
  const result = await importProductsCSV(csvText);

  return apiSuccess(result);
});
