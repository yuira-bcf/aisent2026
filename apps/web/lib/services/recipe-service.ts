import { db } from "@/lib/db";
import {
  flavors,
  recipeFlavors,
  recipeReviews,
  signatureRecipes,
  users,
} from "@kyarainnovate/db/schema";
import type { NoteType, RecipeStatus } from "@kyarainnovate/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

export const createRecipeSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    concept: z.string().optional(),
    themeId: z.string().optional(),
    subTheme: z.string().optional(),
    topRatio: z.number().min(0).max(100),
    middleRatio: z.number().min(0).max(100),
    lastRatio: z.number().min(0).max(100),
    price30ml: z.number().int().optional(),
    price50ml: z.number().int().optional(),
    flavors: z
      .array(
        z.object({
          flavorId: z.string().uuid(),
          ratio: z.number().min(0).max(100),
          noteType: z.enum(["TOP", "MIDDLE", "LAST"]),
        }),
      )
      .min(1),
  })
  .refine((d) => d.topRatio + d.middleRatio + d.lastRatio === 100, {
    message: "比率の合計は100%にしてください",
  })
  .refine(
    (d) => {
      const sum = d.flavors.reduce((acc, f) => acc + f.ratio, 0);
      return Math.abs(sum - 100) < 0.01;
    },
    { message: "フレーバーの配合比率の合計は100%にしてください" },
  );

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = z
  .object({
    recipeId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    concept: z.string().optional(),
    themeId: z.string().optional(),
    subTheme: z.string().optional(),
    topRatio: z.number().min(0).max(100),
    middleRatio: z.number().min(0).max(100),
    lastRatio: z.number().min(0).max(100),
    price30ml: z.number().int().optional(),
    price50ml: z.number().int().optional(),
    flavors: z
      .array(
        z.object({
          flavorId: z.string().uuid(),
          ratio: z.number().min(0).max(100),
          noteType: z.enum(["TOP", "MIDDLE", "LAST"]),
        }),
      )
      .min(1),
  })
  .refine((d) => d.topRatio + d.middleRatio + d.lastRatio === 100, {
    message: "比率の合計は100%にしてください",
  })
  .refine(
    (d) => {
      const sum = d.flavors.reduce((acc, f) => acc + f.ratio, 0);
      return Math.abs(sum - 100) < 0.01;
    },
    { message: "フレーバーの配合比率の合計は100%にしてください" },
  );

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecipeListItem = {
  id: string;
  name: string;
  creatorName: string;
  themeId: string | null;
  subTheme: string | null;
  status: RecipeStatus;
  rating: number | null;
  orderCount: number;
  price30ml: number | null;
  price50ml: number | null;
  createdAt: Date;
};

export type RecipeFlavorDetail = {
  flavorId: string;
  nameJa: string;
  nameEn: string;
  ratio: string;
  noteType: NoteType;
};

export type RecipeReviewSummary = {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: Date;
};

export type RecipeDetail = RecipeListItem & {
  description: string | null;
  concept: string | null;
  topRatio: string;
  middleRatio: string;
  lastRatio: string;
  flavors: RecipeFlavorDetail[];
  reviews: RecipeReviewSummary[];
};

// ---------------------------------------------------------------------------
// createRecipe – Insert recipe + flavors in a transaction
// ---------------------------------------------------------------------------

export async function createRecipe(
  creatorId: string,
  input: CreateRecipeInput,
): Promise<{ recipeId: string }> {
  const [recipe] = await db
    .insert(signatureRecipes)
    .values({
      creatorId,
      name: input.name,
      description: input.description ?? null,
      concept: input.concept ?? null,
      themeId: input.themeId ?? null,
      subTheme: input.subTheme ?? null,
      topRatio: input.topRatio.toFixed(2),
      middleRatio: input.middleRatio.toFixed(2),
      lastRatio: input.lastRatio.toFixed(2),
      price30ml: input.price30ml ?? null,
      price50ml: input.price50ml ?? null,
      status: "DRAFT",
    })
    .returning();

  await db.insert(recipeFlavors).values(
    input.flavors.map((f) => ({
      recipeId: recipe.id,
      flavorId: f.flavorId,
      ratio: f.ratio.toFixed(2),
      noteType: f.noteType as NoteType,
    })),
  );

  return { recipeId: recipe.id };
}

// ---------------------------------------------------------------------------
// updateRecipe – Verify ownership, update recipe, replace flavors
// ---------------------------------------------------------------------------

export async function updateRecipe(
  creatorId: string,
  input: UpdateRecipeInput,
): Promise<boolean> {
  // Verify ownership
  const [existing] = await db
    .select({ id: signatureRecipes.id, version: signatureRecipes.version })
    .from(signatureRecipes)
    .where(
      and(
        eq(signatureRecipes.id, input.recipeId),
        eq(signatureRecipes.creatorId, creatorId),
      ),
    );

  if (!existing) return false;

  // Update recipe
  await db
    .update(signatureRecipes)
    .set({
      name: input.name,
      description: input.description ?? null,
      concept: input.concept ?? null,
      themeId: input.themeId ?? null,
      subTheme: input.subTheme ?? null,
      topRatio: input.topRatio.toFixed(2),
      middleRatio: input.middleRatio.toFixed(2),
      lastRatio: input.lastRatio.toFixed(2),
      price30ml: input.price30ml ?? null,
      price50ml: input.price50ml ?? null,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(signatureRecipes.id, input.recipeId));

  // Delete old flavors and insert new ones
  await db
    .delete(recipeFlavors)
    .where(eq(recipeFlavors.recipeId, input.recipeId));

  await db.insert(recipeFlavors).values(
    input.flavors.map((f) => ({
      recipeId: input.recipeId,
      flavorId: f.flavorId,
      ratio: f.ratio.toFixed(2),
      noteType: f.noteType as NoteType,
    })),
  );

  return true;
}

// ---------------------------------------------------------------------------
// publishRecipe – Set status to PUBLISHED
// ---------------------------------------------------------------------------

export async function publishRecipe(
  creatorId: string,
  recipeId: string,
): Promise<boolean> {
  const result = await db
    .update(signatureRecipes)
    .set({
      status: "PUBLISHED",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(signatureRecipes.id, recipeId),
        eq(signatureRecipes.creatorId, creatorId),
      ),
    )
    .returning({ id: signatureRecipes.id });

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// archiveRecipe – Set status to ARCHIVED
// ---------------------------------------------------------------------------

export async function archiveRecipe(
  creatorId: string,
  recipeId: string,
): Promise<boolean> {
  const result = await db
    .update(signatureRecipes)
    .set({ status: "ARCHIVED", updatedAt: new Date() })
    .where(
      and(
        eq(signatureRecipes.id, recipeId),
        eq(signatureRecipes.creatorId, creatorId),
      ),
    )
    .returning({ id: signatureRecipes.id });

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// getRecipesByCreator – Paginated list of a creator's recipes
// ---------------------------------------------------------------------------

export async function getRecipesByCreator(
  creatorId: string,
  page: number,
  limit: number,
): Promise<{ items: RecipeListItem[]; total: number }> {
  const offset = (page - 1) * limit;

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: signatureRecipes.id,
        name: signatureRecipes.name,
        creatorName: users.name,
        themeId: signatureRecipes.themeId,
        subTheme: signatureRecipes.subTheme,
        status: signatureRecipes.status,
        rating: sql<number | null>`(
          SELECT AVG(${recipeReviews.rating})::numeric(3,2)
          FROM ${recipeReviews}
          WHERE ${recipeReviews.recipeId} = ${signatureRecipes.id}
            AND ${recipeReviews.isVisible} = true
        )`.as("rating"),
        orderCount: signatureRecipes.orderCount,
        price30ml: signatureRecipes.price30ml,
        price50ml: signatureRecipes.price50ml,
        createdAt: signatureRecipes.createdAt,
      })
      .from(signatureRecipes)
      .innerJoin(users, eq(signatureRecipes.creatorId, users.id))
      .where(eq(signatureRecipes.creatorId, creatorId))
      .orderBy(desc(signatureRecipes.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(signatureRecipes)
      .where(eq(signatureRecipes.creatorId, creatorId)),
  ]);

  return {
    items: rows.map((row) => ({
      ...row,
      status: row.status as RecipeStatus,
      rating: row.rating ? Number(row.rating) : null,
    })),
    total,
  };
}

// ---------------------------------------------------------------------------
// getRecipeDetail – Single recipe with creator info, flavors, reviews
// ---------------------------------------------------------------------------

export async function getRecipeDetail(
  recipeId: string,
): Promise<RecipeDetail | null> {
  // Get recipe with creator
  const [recipe] = await db
    .select({
      id: signatureRecipes.id,
      name: signatureRecipes.name,
      creatorId: signatureRecipes.creatorId,
      creatorName: users.name,
      description: signatureRecipes.description,
      concept: signatureRecipes.concept,
      themeId: signatureRecipes.themeId,
      subTheme: signatureRecipes.subTheme,
      status: signatureRecipes.status,
      topRatio: signatureRecipes.topRatio,
      middleRatio: signatureRecipes.middleRatio,
      lastRatio: signatureRecipes.lastRatio,
      orderCount: signatureRecipes.orderCount,
      price30ml: signatureRecipes.price30ml,
      price50ml: signatureRecipes.price50ml,
      createdAt: signatureRecipes.createdAt,
    })
    .from(signatureRecipes)
    .innerJoin(users, eq(signatureRecipes.creatorId, users.id))
    .where(eq(signatureRecipes.id, recipeId));

  if (!recipe) return null;

  // Get average rating
  const [{ avgRating }] = await db
    .select({
      avgRating: sql<number | null>`AVG(${recipeReviews.rating})::numeric(3,2)`,
    })
    .from(recipeReviews)
    .where(
      and(
        eq(recipeReviews.recipeId, recipeId),
        eq(recipeReviews.isVisible, true),
      ),
    );

  // Get flavors
  const flavorRows = await db
    .select({
      flavorId: recipeFlavors.flavorId,
      nameJa: flavors.nameJa,
      nameEn: flavors.nameEn,
      ratio: recipeFlavors.ratio,
      noteType: recipeFlavors.noteType,
    })
    .from(recipeFlavors)
    .innerJoin(flavors, eq(recipeFlavors.flavorId, flavors.id))
    .where(eq(recipeFlavors.recipeId, recipeId));

  // Get latest 5 reviews
  const reviewRows = await db
    .select({
      id: recipeReviews.id,
      userId: recipeReviews.userId,
      userName: users.name,
      rating: recipeReviews.rating,
      title: recipeReviews.title,
      comment: recipeReviews.comment,
      createdAt: recipeReviews.createdAt,
    })
    .from(recipeReviews)
    .innerJoin(users, eq(recipeReviews.userId, users.id))
    .where(
      and(
        eq(recipeReviews.recipeId, recipeId),
        eq(recipeReviews.isVisible, true),
      ),
    )
    .orderBy(desc(recipeReviews.createdAt))
    .limit(5);

  return {
    id: recipe.id,
    name: recipe.name,
    creatorName: recipe.creatorName,
    description: recipe.description,
    concept: recipe.concept,
    themeId: recipe.themeId,
    subTheme: recipe.subTheme,
    status: recipe.status as RecipeStatus,
    topRatio: recipe.topRatio,
    middleRatio: recipe.middleRatio,
    lastRatio: recipe.lastRatio,
    rating: avgRating ? Number(avgRating) : null,
    orderCount: recipe.orderCount,
    price30ml: recipe.price30ml,
    price50ml: recipe.price50ml,
    createdAt: recipe.createdAt,
    flavors: flavorRows,
    reviews: reviewRows,
  };
}

// ---------------------------------------------------------------------------
// getPublishedRecipes – Paginated list of published recipes (customer browse)
// ---------------------------------------------------------------------------

export async function getPublishedRecipes(
  page: number,
  limit: number,
  filters?: { themeId?: string; sortBy?: string },
): Promise<{ items: RecipeListItem[]; total: number }> {
  const offset = (page - 1) * limit;

  const conditions = [eq(signatureRecipes.status, "PUBLISHED" as RecipeStatus)];

  if (filters?.themeId) {
    conditions.push(eq(signatureRecipes.themeId, filters.themeId));
  }

  const where = and(...conditions);

  // Determine sort order
  let orderByClause;
  switch (filters?.sortBy) {
    case "popular":
      orderByClause = desc(signatureRecipes.orderCount);
      break;
    case "rating":
      orderByClause = sql`rating DESC NULLS LAST`;
      break;
    default:
      orderByClause = desc(signatureRecipes.createdAt);
  }

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: signatureRecipes.id,
        name: signatureRecipes.name,
        creatorName: users.name,
        themeId: signatureRecipes.themeId,
        subTheme: signatureRecipes.subTheme,
        status: signatureRecipes.status,
        rating: sql<number | null>`(
          SELECT AVG(${recipeReviews.rating})::numeric(3,2)
          FROM ${recipeReviews}
          WHERE ${recipeReviews.recipeId} = ${signatureRecipes.id}
            AND ${recipeReviews.isVisible} = true
        )`.as("rating"),
        orderCount: signatureRecipes.orderCount,
        price30ml: signatureRecipes.price30ml,
        price50ml: signatureRecipes.price50ml,
        createdAt: signatureRecipes.createdAt,
      })
      .from(signatureRecipes)
      .innerJoin(users, eq(signatureRecipes.creatorId, users.id))
      .where(where)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(signatureRecipes).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      ...row,
      status: row.status as RecipeStatus,
      rating: row.rating ? Number(row.rating) : null,
    })),
    total,
  };
}
