import { db } from "@/lib/db";
import { notifyCreatorApplicationResult } from "@/lib/services/notification-service";
import type {
  CreatorApplicationInput,
  UpdateProfileInput,
  UpdateStyleInput,
} from "@/lib/validations/creator";
import {
  creatorApplications,
  creatorFavorites,
  creatorProfiles,
  creatorStats,
  keywordFlavorRules,
  keywords,
  signatureRecipes,
  users,
} from "@kyarainnovate/db/schema";
import type { ApplicationStatus, Tier } from "@kyarainnovate/db/schema";
import { and, count, countDistinct, desc, eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreatorProfile = {
  id: string;
  userId: string;
  displayName: string;
  creatorIdSlug: string;
  bio: string | null;
  avatarUrl: string | null;
  specialties: string[] | null;
  styleDescription: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string> | null;
  isActive: boolean;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatorStyleProfile = {
  styleDescription: string | null;
  stylePrompt: string | null;
  styleNoteBalance: Record<string, number> | null;
  styleFlavorPreferences: Record<string, number> | null;
};

export type CreatorProfileWithStats = CreatorProfile & {
  stats: {
    tier: Tier;
    tierScore: string;
    recipeSalesCount: number;
    recipeReviewCount: number;
    avgRating: string;
    repeatRate: string;
    favoriteCount: number;
  } | null;
  publishedRecipeCount: number;
};

export type CreatorListItem = {
  id: string;
  userId: string;
  displayName: string;
  creatorIdSlug: string;
  bio: string | null;
  avatarUrl: string | null;
  specialties: string[] | null;
  tier: Tier;
  tierScore: string;
  avgRating: string;
  recipeSalesCount: number;
  favoriteCount: number;
};

export type CreatorDetailRecipe = {
  id: string;
  name: string;
  status: string;
  orderCount: number;
  createdAt: Date;
};

export type CreatorDetail = CreatorProfileWithStats & {
  recipes: CreatorDetailRecipe[];
};

// ---------------------------------------------------------------------------
// 1. Profile CRUD
// ---------------------------------------------------------------------------

/** プロフィール取得（userId で検索） */
export async function getCreatorProfile(
  userId: string,
): Promise<CreatorProfile | null> {
  const [profile] = await db
    .select()
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, userId));

  return profile ?? null;
}

/** プロフィール更新 */
export async function updateCreatorProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<CreatorProfile> {
  const [updated] = await db
    .update(creatorProfiles)
    .set({
      displayName: input.displayName,
      bio: input.bio,
      specialties: input.specialties,
      socialLinks: input.socialLinks,
      updatedAt: new Date(),
    })
    .where(eq(creatorProfiles.userId, userId))
    .returning();

  if (!updated) {
    throw new Error("クリエータープロフィールが見つかりません");
  }

  return updated;
}

// ---------------------------------------------------------------------------
// 2. Style CRUD
// ---------------------------------------------------------------------------

/** スタイルプロファイル取得 */
export async function getCreatorStyle(
  userId: string,
): Promise<CreatorStyleProfile | null> {
  const [row] = await db
    .select({
      styleDescription: creatorProfiles.styleDescription,
      stylePrompt: creatorProfiles.stylePrompt,
      styleNoteBalance: creatorProfiles.styleNoteBalance,
      styleFlavorPreferences: creatorProfiles.styleFlavorPreferences,
    })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, userId));

  return row ?? null;
}

/** スタイルプロファイル更新 */
export async function updateCreatorStyle(
  userId: string,
  input: UpdateStyleInput,
): Promise<CreatorStyleProfile> {
  const [updated] = await db
    .update(creatorProfiles)
    .set({
      styleDescription: input.styleDescription,
      stylePrompt: input.stylePrompt,
      styleNoteBalance: input.styleNoteBalance,
      styleFlavorPreferences: input.styleFlavorPreferences
        ? Object.fromEntries(
            input.styleFlavorPreferences.map((p) => [p.flavorId, p.bias]),
          )
        : undefined,
      updatedAt: new Date(),
    })
    .where(eq(creatorProfiles.userId, userId))
    .returning({
      styleDescription: creatorProfiles.styleDescription,
      stylePrompt: creatorProfiles.stylePrompt,
      styleNoteBalance: creatorProfiles.styleNoteBalance,
      styleFlavorPreferences: creatorProfiles.styleFlavorPreferences,
    });

  if (!updated) {
    throw new Error("クリエータープロフィールが見つかりません");
  }

  return updated;
}

// ---------------------------------------------------------------------------
// 3. Creator Listing (public)
// ---------------------------------------------------------------------------

// Subquery: keyword coverage ratio for a creator (preset keywords with at least 1 rule)
const keywordCoverageSubquery = sql<number>`(
	SELECT COUNT(DISTINCT ${keywordFlavorRules.keywordId})::float
	FROM ${keywordFlavorRules}
	INNER JOIN ${keywords} ON ${keywords.id} = ${keywordFlavorRules.keywordId}
	WHERE ${keywordFlavorRules.creatorId} = ${creatorProfiles.userId}
	AND ${keywords.isPreset} = true
) / GREATEST((SELECT COUNT(*) FROM ${keywords} WHERE ${keywords.isPreset} = true), 1)`;

const COVERAGE_THRESHOLD = 0.5;

/** PICKUPクリエイター（avgRating DESC + favoriteCount DESC 上位3名） */
export async function getPickupCreators(): Promise<
  (CreatorListItem & {
    styleDescription: string | null;
    latestRecipeName: string | null;
  })[]
> {
  const rows = await db
    .select({
      id: creatorProfiles.id,
      userId: creatorProfiles.userId,
      displayName: creatorProfiles.displayName,
      creatorIdSlug: creatorProfiles.creatorIdSlug,
      bio: creatorProfiles.bio,
      avatarUrl: creatorProfiles.avatarUrl,
      specialties: creatorProfiles.specialties,
      styleDescription: creatorProfiles.styleDescription,
      tier: creatorStats.tier,
      tierScore: creatorStats.tierScore,
      avgRating: creatorStats.avgRating,
      recipeSalesCount: creatorStats.recipeSalesCount,
      favoriteCount: creatorStats.favoriteCount,
    })
    .from(creatorProfiles)
    .innerJoin(creatorStats, eq(creatorProfiles.userId, creatorStats.userId))
    .where(
      and(
        eq(creatorProfiles.isActive, true),
        sql`${keywordCoverageSubquery} >= ${COVERAGE_THRESHOLD}`,
      ),
    )
    .orderBy(desc(creatorStats.avgRating), desc(creatorStats.favoriteCount))
    .limit(3);

  const results = await Promise.all(
    rows.map(async (row) => {
      const [recipe] = await db
        .select({ name: signatureRecipes.name })
        .from(signatureRecipes)
        .where(
          and(
            eq(signatureRecipes.creatorId, row.userId),
            eq(signatureRecipes.status, "PUBLISHED"),
          ),
        )
        .orderBy(desc(signatureRecipes.createdAt))
        .limit(1);
      return { ...row, latestRecipeName: recipe?.name ?? null };
    }),
  );

  return results;
}

/** クリエイターカード用: 最新公開レシピ1件取得 */
export async function getLatestRecipeForCreators(
  creatorUserIds: string[],
): Promise<Record<string, string>> {
  if (creatorUserIds.length === 0) return {};
  const recipes = await db
    .select({
      creatorId: signatureRecipes.creatorId,
      name: signatureRecipes.name,
    })
    .from(signatureRecipes)
    .where(
      and(
        sql`${signatureRecipes.creatorId} = ANY(${creatorUserIds})`,
        eq(signatureRecipes.status, "PUBLISHED"),
      ),
    )
    .orderBy(desc(signatureRecipes.createdAt));

  const map: Record<string, string> = {};
  for (const r of recipes) {
    if (!map[r.creatorId]) map[r.creatorId] = r.name;
  }
  return map;
}

/** 公開・承認済みクリエイター一覧（ページネーション） */
export async function getActiveCreators(
  page: number,
  limit: number,
  filters?: {
    specialty?: string;
    search?: string;
    sortBy?: "newest" | "rating" | "sales";
    tier?: string;
  },
): Promise<{ items: CreatorListItem[]; total: number }> {
  const offset = (page - 1) * limit;

  let orderByClause: ReturnType<typeof desc>;
  switch (filters?.sortBy) {
    case "rating":
      orderByClause = desc(creatorStats.avgRating);
      break;
    case "sales":
      orderByClause = desc(creatorStats.recipeSalesCount);
      break;
    case "newest":
      orderByClause = desc(creatorProfiles.createdAt);
      break;
    default:
      orderByClause = desc(creatorStats.tierScore);
  }

  const baseConditions = [
    eq(creatorProfiles.isActive, true),
    sql`${keywordCoverageSubquery} >= ${COVERAGE_THRESHOLD}`,
  ];

  if (filters?.specialty) {
    baseConditions.push(
      sql`${creatorProfiles.specialties}::jsonb @> ${JSON.stringify([filters.specialty])}::jsonb`,
    );
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    baseConditions.push(
      sql`(${creatorProfiles.displayName} ILIKE ${term} OR ${creatorProfiles.bio} ILIKE ${term})`,
    );
  }

  if (filters?.tier) {
    baseConditions.push(eq(creatorStats.tier, filters.tier as Tier));
  }

  const where = and(...baseConditions);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: creatorProfiles.id,
        userId: creatorProfiles.userId,
        displayName: creatorProfiles.displayName,
        creatorIdSlug: creatorProfiles.creatorIdSlug,
        bio: creatorProfiles.bio,
        avatarUrl: creatorProfiles.avatarUrl,
        specialties: creatorProfiles.specialties,
        tier: creatorStats.tier,
        tierScore: creatorStats.tierScore,
        avgRating: creatorStats.avgRating,
        recipeSalesCount: creatorStats.recipeSalesCount,
        favoriteCount: creatorStats.favoriteCount,
      })
      .from(creatorProfiles)
      .innerJoin(creatorStats, eq(creatorProfiles.userId, creatorStats.userId))
      .where(where)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(creatorProfiles)
      .innerJoin(creatorStats, eq(creatorProfiles.userId, creatorStats.userId))
      .where(where),
  ]);

  return { items: rows, total };
}

/** クリエーター詳細（プロフィール + 代表レシピ + 統計） */
export async function getCreatorDetail(
  creatorId: string,
): Promise<CreatorDetail | null> {
  const [profile] = await db
    .select()
    .from(creatorProfiles)
    .where(
      and(
        eq(creatorProfiles.userId, creatorId),
        eq(creatorProfiles.isActive, true),
      ),
    );

  if (!profile) return null;

  const [stats, [{ value: publishedRecipeCount }], recipes] = await Promise.all(
    [
      db
        .select()
        .from(creatorStats)
        .where(eq(creatorStats.userId, profile.userId))
        .then((rows) => rows[0] ?? null),
      db
        .select({ value: count() })
        .from(signatureRecipes)
        .where(
          and(
            eq(signatureRecipes.creatorId, profile.userId),
            eq(signatureRecipes.status, "PUBLISHED"),
          ),
        ),
      db
        .select({
          id: signatureRecipes.id,
          name: signatureRecipes.name,
          status: signatureRecipes.status,
          orderCount: signatureRecipes.orderCount,
          createdAt: signatureRecipes.createdAt,
        })
        .from(signatureRecipes)
        .where(
          and(
            eq(signatureRecipes.creatorId, profile.userId),
            eq(signatureRecipes.status, "PUBLISHED"),
          ),
        )
        .orderBy(desc(signatureRecipes.orderCount))
        .limit(10),
    ],
  );

  return {
    ...profile,
    stats: stats
      ? {
          tier: stats.tier,
          tierScore: stats.tierScore,
          recipeSalesCount: stats.recipeSalesCount,
          recipeReviewCount: stats.recipeReviewCount,
          avgRating: stats.avgRating,
          repeatRate: stats.repeatRate,
          favoriteCount: stats.favoriteCount,
        }
      : null,
    publishedRecipeCount,
    recipes,
  };
}

// ---------------------------------------------------------------------------
// 4. Favorites
// ---------------------------------------------------------------------------

/** お気に入りトグル（存在すれば削除、なければ追加） */
export async function toggleFavorite(
  userId: string,
  creatorId: string,
): Promise<{ favorited: boolean }> {
  const [existing] = await db
    .select({ id: creatorFavorites.id })
    .from(creatorFavorites)
    .where(
      and(
        eq(creatorFavorites.userId, userId),
        eq(creatorFavorites.creatorId, creatorId),
      ),
    );

  if (existing) {
    await db
      .delete(creatorFavorites)
      .where(eq(creatorFavorites.id, existing.id));

    await db
      .update(creatorStats)
      .set({
        favoriteCount: sql`GREATEST(${creatorStats.favoriteCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(creatorStats.userId, creatorId));

    return { favorited: false };
  }

  await db.insert(creatorFavorites).values({
    userId,
    creatorId,
  });

  await db
    .update(creatorStats)
    .set({
      favoriteCount: sql`${creatorStats.favoriteCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(creatorStats.userId, creatorId));

  return { favorited: true };
}

/** お気に入りクリエーター一覧 */
export async function getMyFavoriteCreators(
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: CreatorListItem[]; total: number }> {
  const offset = (page - 1) * limit;

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: creatorProfiles.id,
        userId: creatorProfiles.userId,
        displayName: creatorProfiles.displayName,
        creatorIdSlug: creatorProfiles.creatorIdSlug,
        bio: creatorProfiles.bio,
        avatarUrl: creatorProfiles.avatarUrl,
        specialties: creatorProfiles.specialties,
        tier: creatorStats.tier,
        tierScore: creatorStats.tierScore,
        avgRating: creatorStats.avgRating,
        recipeSalesCount: creatorStats.recipeSalesCount,
        favoriteCount: creatorStats.favoriteCount,
      })
      .from(creatorFavorites)
      .innerJoin(
        creatorProfiles,
        eq(creatorFavorites.creatorId, creatorProfiles.userId),
      )
      .innerJoin(creatorStats, eq(creatorProfiles.userId, creatorStats.userId))
      .where(eq(creatorFavorites.userId, userId))
      .orderBy(desc(creatorFavorites.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(creatorFavorites)
      .where(eq(creatorFavorites.userId, userId)),
  ]);

  return { items: rows, total };
}

// ---------------------------------------------------------------------------
// 5. Creator Application Flow
// ---------------------------------------------------------------------------

/** クリエーター登録申請 */
export async function submitCreatorApplication(
  userId: string,
  input: CreatorApplicationInput,
): Promise<{ applicationId: string }> {
  // 重複申請チェック
  const existingApplication = await db
    .select({ id: creatorApplications.id })
    .from(creatorApplications)
    .where(
      and(
        eq(creatorApplications.userId, userId),
        eq(creatorApplications.status, "PENDING" as ApplicationStatus),
      ),
    );

  if (existingApplication.length > 0) {
    throw new Error("審査中の申請がすでに存在します");
  }

  // 既存プロフィールチェック
  const existingProfile = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, userId));

  if (existingProfile.length > 0) {
    throw new Error("すでにクリエータープロフィールが承認されています");
  }

  // slug 重複チェック
  const existingSlug = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.creatorIdSlug, input.creatorIdSlug));

  if (existingSlug.length > 0) {
    throw new Error("このクリエーターIDは既に使用されています");
  }

  const [application] = await db
    .insert(creatorApplications)
    .values({
      userId,
      displayName: input.displayName,
      creatorIdSlug: input.creatorIdSlug,
      bio: input.bio,
      specialties: input.specialties,
      portfolioDescription: input.portfolioDescription ?? null,
      motivation: input.motivation,
      status: "PENDING",
    })
    .returning();

  return { applicationId: application.id };
}

/** 最新の申請を取得 */
export async function getMyApplication(userId: string) {
  const application = await db
    .select()
    .from(creatorApplications)
    .where(eq(creatorApplications.userId, userId))
    .orderBy(desc(creatorApplications.createdAt))
    .limit(1);

  return application[0] ?? null;
}

/** 管理者承認 */
export async function approveCreatorApplication(
  applicationId: string,
  adminUserId: string,
): Promise<boolean> {
  const [application] = await db
    .select()
    .from(creatorApplications)
    .where(eq(creatorApplications.id, applicationId));

  if (!application) {
    throw new Error("申請が見つかりません");
  }

  if (application.status !== "PENDING") {
    throw new Error("この申請はすでに審査済みです");
  }

  // 申請ステータス更新
  await db
    .update(creatorApplications)
    .set({
      status: "APPROVED" as ApplicationStatus,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creatorApplications.id, applicationId));

  // ユーザーロール変更
  await db
    .update(users)
    .set({ role: "CREATOR" })
    .where(eq(users.id, application.userId));

  // プロフィール作成
  await db.insert(creatorProfiles).values({
    userId: application.userId,
    displayName: application.displayName,
    creatorIdSlug: application.creatorIdSlug,
    bio: application.bio,
    specialties: application.specialties,
    isActive: true,
    approvedAt: new Date(),
  });

  // 統計レコード作成（初期値）
  await db.insert(creatorStats).values({
    userId: application.userId,
    tier: "APPRENTICE",
    tierScore: "0.00",
  });

  // Notify applicant
  notifyCreatorApplicationResult(application.userId, true).catch((err) =>
    console.error("[creator-profile-service] notification failed:", err),
  );

  return true;
}

/** 管理者却下 */
export async function rejectCreatorApplication(
  applicationId: string,
  adminUserId: string,
  reason: string,
): Promise<boolean> {
  const [application] = await db
    .select()
    .from(creatorApplications)
    .where(eq(creatorApplications.id, applicationId));

  if (!application) {
    throw new Error("申請が見つかりません");
  }

  if (application.status !== "PENDING") {
    throw new Error("この申請はすでに審査済みです");
  }

  await db
    .update(creatorApplications)
    .set({
      status: "REJECTED" as ApplicationStatus,
      rejectionReason: reason,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creatorApplications.id, applicationId));

  // Notify applicant
  notifyCreatorApplicationResult(application.userId, false, reason).catch(
    (err) =>
      console.error("[creator-profile-service] notification failed:", err),
  );

  return true;
}

// ---------------------------------------------------------------------------
// 6. Tier calculation (utility)
// ---------------------------------------------------------------------------

/** ティアスコア再計算・更新 */
export async function recalculateCreatorTier(
  creatorUserId: string,
): Promise<{ tier: Tier; tierScore: number }> {
  const [stats] = await db
    .select()
    .from(creatorStats)
    .where(eq(creatorStats.userId, creatorUserId));

  if (!stats) {
    throw new Error("クリエーター統計情報が見つかりません");
  }

  // §7.2 正規化スコア計算
  const avgRating = Number(stats.avgRating);
  const repeatRate = Number(stats.repeatRate);

  const ratingNorm = ((avgRating - 1.0) / 4.0) * 100;
  const repeatNorm = repeatRate;
  const favoriteNorm = Math.min(
    (Math.log(stats.favoriteCount + 1) / Math.log(500)) * 100,
    100,
  );
  const salesNorm = Math.min(
    (Math.log(stats.recipeSalesCount + 1) / Math.log(1000)) * 100,
    100,
  );
  const reviewNorm = Math.min(
    (Math.log(stats.recipeReviewCount + 1) / Math.log(300)) * 100,
    100,
  );

  const tierScore =
    ratingNorm * 0.3 +
    repeatNorm * 0.25 +
    favoriteNorm * 0.2 +
    salesNorm * 0.15 +
    reviewNorm * 0.1;

  // §7.1 ティア判定（§7.3 足切り条件込み）
  let tier: Tier = "APPRENTICE";

  if (
    tierScore >= 90 &&
    stats.recipeSalesCount >= 500 &&
    stats.recipeReviewCount >= 150 &&
    avgRating >= 4.5
  ) {
    tier = "GRAND_MASTER";
  } else if (
    tierScore >= 75 &&
    stats.recipeSalesCount >= 300 &&
    stats.recipeReviewCount >= 80 &&
    avgRating >= 4.3
  ) {
    tier = "MASTER";
  } else if (
    tierScore >= 55 &&
    stats.recipeSalesCount >= 150 &&
    stats.recipeReviewCount >= 40 &&
    avgRating >= 4.0
  ) {
    tier = "EXPERT";
  } else if (
    tierScore >= 30 &&
    stats.recipeSalesCount >= 50 &&
    stats.recipeReviewCount >= 10 &&
    avgRating >= 3.5
  ) {
    tier = "ARTISAN";
  }

  await db
    .update(creatorStats)
    .set({
      tier,
      tierScore: tierScore.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(creatorStats.userId, creatorUserId));

  return { tier, tierScore };
}
