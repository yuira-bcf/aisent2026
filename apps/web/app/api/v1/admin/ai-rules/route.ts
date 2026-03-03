import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { aiBlendRules, ruleTypeEnum } from "@kyarainnovate/db/schema";
import { desc } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/ai-rules
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const rules = await db
    .select()
    .from(aiBlendRules)
    .orderBy(desc(aiBlendRules.priority));

  return apiSuccess({ rules });
});

/**
 * POST /api/v1/admin/ai-rules
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || body.name.length > 100) {
    return VALIDATION_ERROR("ルール名は1〜100文字で入力してください");
  }
  if (!ruleTypeEnum.includes(body.ruleType)) {
    return VALIDATION_ERROR("無効なルールタイプです");
  }

  const rule = await db
    .insert(aiBlendRules)
    .values({
      name: body.name,
      description: body.description || null,
      ruleType: body.ruleType,
      parameter: body.parameter || null,
      isActive: body.isActive ?? true,
      priority: body.priority ?? 0,
    })
    .returning();

  return apiSuccess({ rule: rule[0] }, 201);
});
