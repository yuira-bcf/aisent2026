import { generateStory } from "@/lib/ai-client";
import { type Rule, calculateAutoBlendGrouped } from "@/lib/blend-calculator";
import { db } from "@/lib/db";
import {
  blendRequestKeywords,
  blendRequests,
  blendResultFlavors,
  blendResults,
  creatorProfiles,
  flavors,
  keywordFlavorRules,
  keywords,
  recipeFlavors,
  signatureRecipes,
  users,
} from "@kyarainnovate/db/schema";
import type { NoteType } from "@kyarainnovate/db/schema";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

export const blendInputSchema = z
  .object({
    topRatio: z.number().min(0).max(100),
    middleRatio: z.number().min(0).max(100),
    lastRatio: z.number().min(0).max(100),
    keywords: z
      .array(
        z.object({
          word: z.string().min(1),
          weight: z.number().min(0).max(10),
        }),
      )
      .min(1),
  })
  .refine((d) => d.topRatio + d.middleRatio + d.lastRatio === 100, {
    message: "比率の合計は100%にしてください",
  });

export type BlendInput = z.infer<typeof blendInputSchema>;

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type ExecuteBlendResult = {
  blendRequestId: string;
  resultId: string;
};

export type BlendResultListItem = {
  id: string;
  name: string | null;
  status: string;
  createdAt: Date;
  keywords: { word: string; weight: number }[];
  ratios: { top: string; middle: string; last: string };
  creatorId: string | null;
  creatorName: string | null;
};

export type BlendResultList = {
  items: BlendResultListItem[];
  total: number;
};

export type BlendResultFlavorDetail = {
  flavorId: string;
  nameJa: string;
  nameEn: string;
  ratio: string;
  noteType: NoteType;
};

export type BlendResultDetail = {
  id: string;
  name: string | null;
  status: string;
  createdAt: Date;
  keywords: { word: string; weight: number }[];
  ratios: { top: string; middle: string; last: string };
  creatorId: string | null;
  creatorName: string | null;
  result: {
    story: string | null;
    flavors: BlendResultFlavorDetail[];
  } | null;
};

// ---------------------------------------------------------------------------
// executeBlend – Full blend orchestration
// ---------------------------------------------------------------------------

export async function executeBlend(params: {
  userId: string;
  keywords: { word: string; weight: number }[];
  topRatio: number;
  middleRatio: number;
  lastRatio: number;
  creatorId?: string;
  parentBlendId?: string;
}): Promise<ExecuteBlendResult> {
  const {
    userId,
    keywords: kwInputs,
    topRatio,
    middleRatio,
    lastRatio,
    creatorId,
    parentBlendId,
  } = params;

  // 1. Find or create keywords
  const keywordIds: { id: string; weight: number }[] = [];

  for (const kwInput of kwInputs) {
    let kw = await db.query.keywords.findFirst({
      where: eq(keywords.word, kwInput.word),
    });

    if (!kw) {
      const [created] = await db
        .insert(keywords)
        .values({ word: kwInput.word, category: "FREE", isPreset: false })
        .returning();
      kw = created;
    }

    // Increment usage count
    await db
      .update(keywords)
      .set({ usageCount: (kw.usageCount ?? 0) + 1 })
      .where(eq(keywords.id, kw.id));

    keywordIds.push({ id: kw.id, weight: kwInput.weight });
  }

  // 2. Create blend request
  const [blendRequest] = await db
    .insert(blendRequests)
    .values({
      userId,
      creatorId: creatorId ?? null,
      parentBlendId: parentBlendId ?? null,
      topRatio: topRatio.toFixed(2),
      middleRatio: middleRatio.toFixed(2),
      lastRatio: lastRatio.toFixed(2),
      status: "PROCESSING",
      manualBlend: false,
    })
    .returning();

  // 3. Save keywords
  await db.insert(blendRequestKeywords).values(
    keywordIds.map((kw) => ({
      blendRequestId: blendRequest.id,
      keywordId: kw.id,
      weight: kw.weight.toString(),
    })),
  );

  // 4. Get rules for these keywords
  const rulesWhereConditions = [
    inArray(
      keywordFlavorRules.keywordId,
      keywordIds.map((k) => k.id),
    ),
  ];
  if (creatorId) {
    rulesWhereConditions.push(eq(keywordFlavorRules.creatorId, creatorId));
  }

  const rules = await db
    .select({
      keywordId: keywordFlavorRules.keywordId,
      flavorId: keywordFlavorRules.flavorId,
      weight: keywordFlavorRules.weight,
      noteType: keywordFlavorRules.noteType,
    })
    .from(keywordFlavorRules)
    .where(and(...rulesWhereConditions));

  // Group rules by keyword
  const rulesByKeywordId = new Map<string, Rule[]>();
  for (const rule of rules) {
    const existing = rulesByKeywordId.get(rule.keywordId) ?? [];
    existing.push({
      flavorId: rule.flavorId,
      weight: rule.weight,
      noteType: rule.noteType,
    });
    rulesByKeywordId.set(rule.keywordId, existing);
  }

  // 5. Apply creator style adjustments if creatorId is set
  let adjustedTopRatio = topRatio;
  let adjustedMiddleRatio = middleRatio;
  let adjustedLastRatio = lastRatio;
  let styleFlavorPreferences: Record<string, number> | null = null;

  const profile = creatorId
    ? await db.query.creatorProfiles.findFirst({
        where: eq(creatorProfiles.userId, creatorId),
        columns: {
          styleNoteBalance: true,
          styleFlavorPreferences: true,
          styleDescription: true,
        },
      })
    : null;

  if (profile) {
    if (profile.styleNoteBalance) {
      const balance = profile.styleNoteBalance;
      adjustedTopRatio = Math.max(
        0,
        Math.min(100, topRatio + (balance.top ?? 0)),
      );
      adjustedMiddleRatio = Math.max(
        0,
        Math.min(100, middleRatio + (balance.middle ?? 0)),
      );
      adjustedLastRatio = Math.max(
        0,
        Math.min(100, lastRatio + (balance.last ?? 0)),
      );
      // Normalize to 100
      const sum = adjustedTopRatio + adjustedMiddleRatio + adjustedLastRatio;
      if (sum > 0) {
        adjustedTopRatio = Math.round((adjustedTopRatio / sum) * 100);
        adjustedMiddleRatio = Math.round((adjustedMiddleRatio / sum) * 100);
        adjustedLastRatio = 100 - adjustedTopRatio - adjustedMiddleRatio;
      }
    }
    if (profile?.styleFlavorPreferences) {
      styleFlavorPreferences = profile.styleFlavorPreferences;
    }
  }

  // 6. Calculate blend
  const resultFlavors = calculateAutoBlendGrouped(
    keywordIds.map((kw) => ({ keywordId: kw.id, weight: kw.weight })),
    rulesByKeywordId,
    {
      topRatio: adjustedTopRatio,
      middleRatio: adjustedMiddleRatio,
      lastRatio: adjustedLastRatio,
    },
  );

  // Apply flavor preferences if available
  if (styleFlavorPreferences) {
    for (const rf of resultFlavors) {
      const boost = styleFlavorPreferences[rf.flavorId];
      if (boost !== undefined) {
        const newRatio = Math.max(0, Number(rf.ratio) + boost);
        rf.ratio = newRatio.toFixed(2);
      }
    }
    // Normalize ratios back to sum to 100
    const totalRatio = resultFlavors.reduce(
      (sum, rf) => sum + Number(rf.ratio),
      0,
    );
    if (totalRatio > 0) {
      for (const rf of resultFlavors) {
        rf.ratio = ((Number(rf.ratio) / totalRatio) * 100).toFixed(2);
      }
    }
  }

  // 7. Save result
  const [result] = await db
    .insert(blendResults)
    .values({ blendRequestId: blendRequest.id })
    .returning();

  if (resultFlavors.length > 0) {
    await db.insert(blendResultFlavors).values(
      resultFlavors.map((rf) => ({
        blendResultId: result.id,
        flavorId: rf.flavorId,
        ratio: rf.ratio,
        noteType: rf.noteType,
      })),
    );
  }

  // 8. Generate story
  const flavorDetails = await db.query.flavors.findMany({
    where: inArray(
      flavors.id,
      resultFlavors.map((rf) => rf.flavorId),
    ),
  });

  const flavorMap = new Map(flavorDetails.map((f) => [f.id, f]));

  // Use style description from profile fetched in step 5
  const styleDescription = profile?.styleDescription ?? undefined;

  const story = await generateStory(
    kwInputs,
    resultFlavors.map((rf) => ({
      nameJa: flavorMap.get(rf.flavorId)?.nameJa ?? "",
      ratio: rf.ratio,
      noteType: rf.noteType,
    })),
    { topRatio, middleRatio, lastRatio },
    styleDescription ? { styleDescription } : undefined,
  );

  await db
    .update(blendResults)
    .set({ story })
    .where(eq(blendResults.id, result.id));

  // 9. Update blend request status to COMPLETED
  await db
    .update(blendRequests)
    .set({ status: "COMPLETED" })
    .where(eq(blendRequests.id, blendRequest.id));

  return {
    blendRequestId: blendRequest.id,
    resultId: result.id,
  };
}

// ---------------------------------------------------------------------------
// executeRecipeBlend – Blend based on a published recipe
// ---------------------------------------------------------------------------

export async function executeRecipeBlend(params: {
  userId: string;
  recipeId: string;
}): Promise<ExecuteBlendResult> {
  const { userId, recipeId } = params;

  // 1. Fetch recipe with flavors
  const recipe = await db.query.signatureRecipes.findFirst({
    where: eq(signatureRecipes.id, recipeId),
    with: { flavors: { with: { flavor: true } } },
  });
  if (!recipe) throw new Error("レシピが見つかりません");

  // 2. Create blend request
  const [blendRequest] = await db
    .insert(blendRequests)
    .values({
      userId,
      creatorId: recipe.creatorId,
      topRatio: recipe.topRatio,
      middleRatio: recipe.middleRatio,
      lastRatio: recipe.lastRatio,
      status: "PROCESSING",
      manualBlend: false,
    })
    .returning();

  // 3. Save result directly from recipe's flavors
  const [result] = await db
    .insert(blendResults)
    .values({ blendRequestId: blendRequest.id })
    .returning();

  if (recipe.flavors.length > 0) {
    await db.insert(blendResultFlavors).values(
      recipe.flavors.map((rf) => ({
        blendResultId: result.id,
        flavorId: rf.flavorId,
        ratio: rf.ratio,
        noteType: rf.noteType,
      })),
    );
  }

  // 4. Generate story
  const story = await generateStory(
    [{ word: recipe.name, weight: 10 }],
    recipe.flavors.map((rf) => ({
      nameJa: rf.flavor.nameJa,
      ratio: rf.ratio,
      noteType: rf.noteType,
    })),
    {
      topRatio: Number(recipe.topRatio),
      middleRatio: Number(recipe.middleRatio),
      lastRatio: Number(recipe.lastRatio),
    },
    recipe.concept ? { styleDescription: recipe.concept } : undefined,
  );

  await db
    .update(blendResults)
    .set({ story })
    .where(eq(blendResults.id, result.id));

  await db
    .update(blendRequests)
    .set({ status: "COMPLETED" })
    .where(eq(blendRequests.id, blendRequest.id));

  return { blendRequestId: blendRequest.id, resultId: result.id };
}

// ---------------------------------------------------------------------------
// getBlendResults – Paginated list for a user
// ---------------------------------------------------------------------------

export async function getBlendResults(
  userId: string,
  page = 1,
  limit = 20,
): Promise<BlendResultList> {
  const offset = (page - 1) * limit;

  const [items, totalResult] = await Promise.all([
    db.query.blendRequests.findMany({
      where: eq(blendRequests.userId, userId),
      orderBy: desc(blendRequests.createdAt),
      limit,
      offset,
      with: {
        keywords: {
          with: { keyword: true },
        },
      },
    }),
    db
      .select({ count: count() })
      .from(blendRequests)
      .where(eq(blendRequests.userId, userId)),
  ]);

  const total = totalResult[0]?.count ?? 0;

  // Batch-fetch creator names for items that have a creatorId
  const creatorIds = [
    ...new Set(
      items.map((i) => i.creatorId).filter((id): id is string => id != null),
    ),
  ];
  const creatorNameMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const creatorRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, creatorIds));
    for (const row of creatorRows) {
      creatorNameMap.set(row.id, row.name);
    }
  }

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      createdAt: item.createdAt,
      keywords: item.keywords.map((k) => ({
        word: k.keyword.word,
        weight: Number(k.weight),
      })),
      ratios: {
        top: item.topRatio,
        middle: item.middleRatio,
        last: item.lastRatio,
      },
      creatorId: item.creatorId ?? null,
      creatorName: item.creatorId
        ? (creatorNameMap.get(item.creatorId) ?? null)
        : null,
    })),
    total,
  };
}

// ---------------------------------------------------------------------------
// getBlendResultDetail – Single result with flavors
// ---------------------------------------------------------------------------

export async function getBlendResultDetail(
  blendRequestId: string,
  userId: string,
): Promise<BlendResultDetail | null> {
  const request = await db.query.blendRequests.findFirst({
    where: and(
      eq(blendRequests.id, blendRequestId),
      eq(blendRequests.userId, userId),
    ),
    with: {
      keywords: {
        with: { keyword: true },
      },
      result: {
        with: {
          flavors: {
            with: { flavor: true },
          },
        },
      },
    },
  });

  if (!request) return null;

  // Fetch creator name if creatorId is set
  let creatorName: string | null = null;
  if (request.creatorId) {
    const creator = await db.query.users.findFirst({
      where: eq(users.id, request.creatorId),
      columns: { name: true },
    });
    creatorName = creator?.name ?? null;
  }

  return {
    id: request.id,
    name: request.name,
    status: request.status,
    createdAt: request.createdAt,
    keywords: request.keywords.map((k) => ({
      word: k.keyword.word,
      weight: Number(k.weight),
    })),
    ratios: {
      top: request.topRatio,
      middle: request.middleRatio,
      last: request.lastRatio,
    },
    creatorId: request.creatorId ?? null,
    creatorName,
    result: request.result
      ? {
          story: request.result.story,
          flavors: request.result.flavors.map((f) => ({
            flavorId: f.flavorId,
            nameJa: f.flavor.nameJa,
            nameEn: f.flavor.nameEn,
            ratio: f.ratio,
            noteType: f.noteType,
          })),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// updateBlendName – Rename a blend request
// ---------------------------------------------------------------------------

export async function updateBlendName(
  blendRequestId: string,
  userId: string,
  name: string,
): Promise<boolean> {
  const result = await db
    .update(blendRequests)
    .set({ name })
    .where(
      and(
        eq(blendRequests.id, blendRequestId),
        eq(blendRequests.userId, userId),
      ),
    )
    .returning({ id: blendRequests.id });

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// getBlendsByCreator – Paginated list of blends using a specific creator's rules
// ---------------------------------------------------------------------------

export async function getBlendsByCreator(
  creatorId: string,
  page = 1,
  limit = 20,
): Promise<BlendResultList> {
  const offset = (page - 1) * limit;

  const [items, totalResult] = await Promise.all([
    db.query.blendRequests.findMany({
      where: eq(blendRequests.creatorId, creatorId),
      orderBy: desc(blendRequests.createdAt),
      limit,
      offset,
      with: {
        keywords: {
          with: { keyword: true },
        },
      },
    }),
    db
      .select({ count: count() })
      .from(blendRequests)
      .where(eq(blendRequests.creatorId, creatorId)),
  ]);

  const total = totalResult[0]?.count ?? 0;

  // Fetch creator name
  let creatorName: string | null = null;
  const creator = await db.query.users.findFirst({
    where: eq(users.id, creatorId),
    columns: { name: true },
  });
  creatorName = creator?.name ?? null;

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      createdAt: item.createdAt,
      keywords: item.keywords.map((k) => ({
        word: k.keyword.word,
        weight: Number(k.weight),
      })),
      ratios: {
        top: item.topRatio,
        middle: item.middleRatio,
        last: item.lastRatio,
      },
      creatorId: item.creatorId ?? null,
      creatorName,
    })),
    total,
  };
}

// ---------------------------------------------------------------------------
// getBlendVersions – Get all versions in a blend chain (root + children)
// ---------------------------------------------------------------------------

export type BlendVersion = {
  id: string;
  version: number;
  createdAt: Date;
};

export async function getBlendVersions(
  blendRequestId: string,
  userId: string,
): Promise<BlendVersion[]> {
  // Walk up to find the root blend
  let rootId = blendRequestId;
  let current = await db.query.blendRequests.findFirst({
    where: and(eq(blendRequests.id, rootId), eq(blendRequests.userId, userId)),
    columns: { id: true, parentBlendId: true },
  });

  if (!current) return [];

  // Walk up parent chain to find root (max 20 iterations to avoid infinite loops)
  let iterations = 0;
  while (current?.parentBlendId && iterations < 20) {
    const parent: { id: string; parentBlendId: string | null } | undefined =
      await db.query.blendRequests.findFirst({
        where: and(
          eq(blendRequests.id, current.parentBlendId),
          eq(blendRequests.userId, userId),
        ),
        columns: { id: true, parentBlendId: true },
      });
    if (!parent) break;
    rootId = parent.id;
    current = parent;
    iterations++;
  }

  // Now find all descendants: root + all that have root as ancestor
  // We do a BFS collecting all versions
  const versions: BlendVersion[] = [];
  const queue = [rootId];
  const visited = new Set<string>();
  let version = 1;

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const blend = await db.query.blendRequests.findFirst({
      where: and(eq(blendRequests.id, id), eq(blendRequests.userId, userId)),
      columns: { id: true, createdAt: true },
    });
    if (!blend) continue;

    versions.push({ id: blend.id, version, createdAt: blend.createdAt });
    version++;

    // Find children
    const children = await db.query.blendRequests.findMany({
      where: and(
        eq(blendRequests.parentBlendId, id),
        eq(blendRequests.userId, userId),
      ),
      columns: { id: true },
      orderBy: [blendRequests.createdAt],
    });
    for (const child of children) {
      queue.push(child.id);
    }
  }

  return versions;
}
