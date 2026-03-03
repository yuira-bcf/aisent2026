import { safeHandler } from "@/lib/api/handler";
import {
  RATE_LIMITS,
  getClientIp,
  rateLimit,
  rateLimitKey,
  tooManyRequestsResponse,
} from "@/lib/api/rate-limiter";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { type Rule, calculateAutoBlendGrouped } from "@/lib/blend-calculator";
import type { NextRequest } from "next/server";
import { z } from "zod";

const calculateSchema = z.object({
  keywords: z
    .array(
      z.object({
        keywordId: z.string(),
        weight: z.number().min(0).max(10),
      }),
    )
    .min(1, "キーワードを1つ以上指定してください")
    .max(10, "キーワードは10個以内にしてください"),
  rules: z.record(
    z.string(), // keywordId
    z
      .array(
        z.object({
          flavorId: z.string(),
          weight: z.string(),
          noteType: z.enum(["TOP", "MIDDLE", "LAST"]),
        }),
      )
      .max(30, "ルールは30個以内にしてください"),
  ),
  ratios: z
    .object({
      topRatio: z.number().min(0).max(100),
      middleRatio: z.number().min(0).max(100),
      lastRatio: z.number().min(0).max(100),
    })
    .refine((r) => r.topRatio + r.middleRatio + r.lastRatio === 100, {
      message: "比率の合計は100にしてください",
    }),
});

/**
 * POST /api/v1/blend/calculate
 *
 * Standalone blend calculation — no auth, no DB.
 * Accepts keyword weights, rules per keyword, and note ratios.
 * Returns calculated flavor ratios.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  // Rate limit check
  const ip = getClientIp(req);
  const rlResult = await rateLimit(
    rateLimitKey("BLEND", ip),
    RATE_LIMITS.BLEND.limit,
    RATE_LIMITS.BLEND.windowSeconds,
  );
  if (!rlResult.allowed) {
    return tooManyRequestsResponse(rlResult, RATE_LIMITS.BLEND.limit);
  }

  const body = await req.json();
  const parsed = calculateSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const { keywords, rules, ratios } = parsed.data;

  const rulesByKeywordId = new Map<string, Rule[]>();
  for (const [keywordId, kwRules] of Object.entries(rules)) {
    rulesByKeywordId.set(keywordId, kwRules);
  }

  const result = calculateAutoBlendGrouped(
    keywords.map((kw) => ({ keywordId: kw.keywordId, weight: kw.weight })),
    rulesByKeywordId,
    ratios,
  );

  return apiSuccess({
    flavors: result.map((f) => ({
      flavorId: f.flavorId,
      ratio: f.ratio,
      noteType: f.noteType,
    })),
  });
});
