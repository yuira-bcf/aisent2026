import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { setProductTags } from "@/lib/services/product-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const setTagsSchema = z.object({
  tags: z
    .array(
      z.object({
        type: z.enum(["season", "scene", "feature"]),
        value: z.string().min(1).max(50),
      }),
    )
    .max(20),
});

export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const { tags } = setTagsSchema.parse(await req.json());
  await setProductTags(id, tags);
  return apiSuccess({ updated: true });
});
