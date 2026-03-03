import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRecipeDetail } from "@/lib/services/recipe-service";
import { flavors } from "@kyarainnovate/db/schema";
import { notFound, redirect } from "next/navigation";
import { RecipeForm } from "../../recipe-form";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const [recipe, flavorList] = await Promise.all([
    getRecipeDetail(id),
    db.select().from(flavors).orderBy(flavors.sortOrder),
  ]);

  if (!recipe) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          レシピ編集
        </h1>
        <p className="text-sm text-gray-400">{recipe.name}</p>
      </div>
      <RecipeForm
        mode="edit"
        recipeId={id}
        initialData={{
          name: recipe.name,
          description: recipe.description ?? "",
          concept: recipe.concept ?? "",
          topRatio: Number(recipe.topRatio),
          middleRatio: Number(recipe.middleRatio),
          lastRatio: Number(recipe.lastRatio),
          price30ml: recipe.price30ml ?? undefined,
          price50ml: recipe.price50ml ?? undefined,
          flavors: recipe.flavors.map((f) => ({
            flavorId: f.flavorId,
            ratio: Number(f.ratio),
            noteType: f.noteType,
          })),
        }}
        flavors={flavorList.map((f) => ({
          id: f.id,
          nameJa: f.nameJa,
          nameEn: f.nameEn,
          noteType: f.noteType,
        }))}
      />
    </div>
  );
}
