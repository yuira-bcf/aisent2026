import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  flavors,
  recipeFlavors,
  signatureRecipes,
} from "@kyarainnovate/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { RecipeEvaluator } from "./recipe-evaluator";

export default async function EvaluationPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Get published recipes that don't have a quality rating yet (subTheme is null as proxy)
  const recipes = await db
    .select({
      id: signatureRecipes.id,
      name: signatureRecipes.name,
      concept: signatureRecipes.concept,
      scene: signatureRecipes.scene,
      mood: signatureRecipes.mood,
      themeId: signatureRecipes.themeId,
      topRatio: signatureRecipes.topRatio,
      middleRatio: signatureRecipes.middleRatio,
      lastRatio: signatureRecipes.lastRatio,
    })
    .from(signatureRecipes)
    .where(eq(signatureRecipes.creatorId, session.user.id))
    .orderBy(signatureRecipes.createdAt)
    .limit(20);

  // Get flavors for each recipe
  const recipeIds = recipes.map((r) => r.id);
  const allRecipeFlavors =
    recipeIds.length > 0
      ? await db
          .select({
            recipeId: recipeFlavors.recipeId,
            flavorId: recipeFlavors.flavorId,
            flavorNameJa: flavors.nameJa,
            noteType: recipeFlavors.noteType,
            ratio: recipeFlavors.ratio,
          })
          .from(recipeFlavors)
          .innerJoin(flavors, eq(recipeFlavors.flavorId, flavors.id))
      : [];

  const recipesWithFlavors = recipes.map((r) => ({
    ...r,
    flavors: allRecipeFlavors.filter((rf) => rf.recipeId === r.id),
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          レシピ評価
        </h1>
        <p className="text-sm text-gray-400">レシピを評価して品質を管理</p>
      </div>
      <RecipeEvaluator recipes={recipesWithFlavors} />
    </div>
  );
}
