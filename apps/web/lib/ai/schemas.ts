import { z } from "zod";

// ---------------------------------------------------------------------------
// suggestRules output
// ---------------------------------------------------------------------------

export const ruleSuggestionSchema = z.array(
  z.object({
    nameEn: z.string(),
    noteType: z.enum(["TOP", "MIDDLE", "LAST"]),
    weight: z.number().min(0).max(1),
  }),
);
export type RuleSuggestion = z.infer<typeof ruleSuggestionSchema>;

// ---------------------------------------------------------------------------
// generateRecipeDescription output
// ---------------------------------------------------------------------------

export const recipeDescriptionSchema = z.object({
  shortDescription: z.string(),
  fullDescription: z.string(),
  targetScene: z.string(),
  keywords: z.array(z.string()),
});
export type RecipeDescription = z.infer<typeof recipeDescriptionSchema>;

// ---------------------------------------------------------------------------
// recommendCreators output
// ---------------------------------------------------------------------------

export const creatorRecommendationSchema = z.array(
  z.object({
    creatorId: z.string(),
    matchScore: z.number().min(0).max(100),
    reason: z.string(),
  }),
);
export type CreatorRecommendation = z.infer<typeof creatorRecommendationSchema>;

// ---------------------------------------------------------------------------
// recommendRecipes output
// ---------------------------------------------------------------------------

export const recipeRecommendationSchema = z.array(
  z.object({
    recipeId: z.string(),
    matchScore: z.number().min(0).max(100),
    reason: z.string(),
    highlightFlavor: z.string(),
  }),
);
export type RecipeRecommendation = z.infer<typeof recipeRecommendationSchema>;

// ---------------------------------------------------------------------------
// moderateReview output
// ---------------------------------------------------------------------------

export const moderationSchema = z.object({
  isApproved: z.boolean(),
  flags: z.array(
    z.enum([
      "SPAM",
      "HARASSMENT",
      "INAPPROPRIATE",
      "FAKE_POSITIVE",
      "FAKE_NEGATIVE",
      "OFF_TOPIC",
      "PERSONAL_INFO",
      "PROMOTIONAL",
    ]),
  ),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type ModerationResult = z.infer<typeof moderationSchema>;
