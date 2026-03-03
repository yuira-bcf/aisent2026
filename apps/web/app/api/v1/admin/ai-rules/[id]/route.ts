import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { aiBlendRules, ruleTypeEnum } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * PUT /api/v1/admin/ai-rules/:id
 */
export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();

  if (
    body.name != null &&
    (typeof body.name !== "string" ||
      body.name.length === 0 ||
      body.name.length > 100)
  ) {
    return VALIDATION_ERROR("ルール名は1〜100文字で入力してください");
  }
  if (body.ruleType != null && !ruleTypeEnum.includes(body.ruleType)) {
    return VALIDATION_ERROR("無効なルールタイプです");
  }

  const existing = await db
    .select()
    .from(aiBlendRules)
    .where(eq(aiBlendRules.id, id))
    .limit(1);
  if (!existing[0]) return NOT_FOUND("ルールが見つかりません");

  const updated = await db
    .update(aiBlendRules)
    .set({
      name: body.name ?? existing[0].name,
      description:
        body.description !== undefined
          ? body.description || null
          : existing[0].description,
      ruleType: body.ruleType ?? existing[0].ruleType,
      parameter:
        body.parameter !== undefined ? body.parameter : existing[0].parameter,
      isActive: body.isActive ?? existing[0].isActive,
      priority: body.priority ?? existing[0].priority,
      updatedAt: new Date(),
    })
    .where(eq(aiBlendRules.id, id))
    .returning();

  return apiSuccess({ rule: updated[0] });
});

/**
 * DELETE /api/v1/admin/ai-rules/:id
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;

  const deleted = await db
    .delete(aiBlendRules)
    .where(eq(aiBlendRules.id, id))
    .returning();

  if (deleted.length === 0) return NOT_FOUND("ルールが見つかりません");

  return apiSuccess({ deleted: true });
});
