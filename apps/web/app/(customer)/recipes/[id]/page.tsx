import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  creatorProfiles,
  flavors,
  recipeFlavors,
  signatureRecipes,
} from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const noteTypeLabel: Record<string, { label: string; className: string }> = {
  TOP: { label: "TOP", className: "bg-red-50 text-red-600" },
  MIDDLE: { label: "MIDDLE", className: "bg-amber-50 text-amber-700" },
  LAST: { label: "LAST", className: "bg-blue-50 text-blue-700" },
};

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  // Fetch recipe
  const [recipe] = await db
    .select()
    .from(signatureRecipes)
    .where(eq(signatureRecipes.id, id));

  if (!recipe || recipe.status !== "PUBLISHED") notFound();

  // Fetch creator profile
  const [creator] = await db
    .select({
      displayName: creatorProfiles.displayName,
      creatorIdSlug: creatorProfiles.creatorIdSlug,
    })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, recipe.creatorId));

  // Fetch recipe flavors with flavor details
  const flavorRows = await db
    .select({
      id: recipeFlavors.id,
      ratio: recipeFlavors.ratio,
      noteType: recipeFlavors.noteType,
      flavorNameJa: flavors.nameJa,
      flavorNameEn: flavors.nameEn,
    })
    .from(recipeFlavors)
    .innerJoin(flavors, eq(recipeFlavors.flavorId, flavors.id))
    .where(eq(recipeFlavors.recipeId, id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href={creator ? `/creators/${creator.creatorIdSlug}` : "/creators"}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-black transition mb-6"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        クリエイターページ
      </Link>

      {/* Recipe Header */}
      <h1 className="text-2xl font-bold tracking-tight text-black mb-2">
        {recipe.name}
      </h1>

      {creator && (
        <Link
          href={`/creators/${creator.creatorIdSlug}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black transition mb-4"
        >
          <span className="material-symbols-outlined text-base">person</span>
          {creator.displayName}
        </Link>
      )}

      {/* Concept / Description */}
      {(recipe.concept || recipe.description) && (
        <div className="mb-8 p-4 border border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-black mb-2">コンセプト</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {recipe.concept || recipe.description}
          </p>
        </div>
      )}

      {/* Flavor Composition */}
      {flavorRows.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-black mb-4">配合比率</h2>
          <div className="space-y-3">
            {flavorRows.map((f) => {
              const ratio = Number(f.ratio);
              const note = noteTypeLabel[f.noteType] ?? {
                label: f.noteType,
                className: "bg-gray-100 text-gray-600",
              };
              return (
                <div key={f.id} className="border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">
                        {f.flavorNameJa}
                      </span>
                      <span className={`text-xs px-2 py-0.5 ${note.className}`}>
                        {note.label}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-black">
                      {ratio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-black"
                      style={{ width: `${Math.min(ratio, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/blend?recipe=${recipe.id}`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm bg-black text-white hover:bg-gray-800 transition"
        >
          <span className="material-symbols-outlined text-base">
            local_florist
          </span>
          このレシピで調合する
        </Link>
        {creator && (
          <Link
            href={`/creators/${creator.creatorIdSlug}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm border border-gray-200 text-black hover:border-black transition"
          >
            <span className="material-symbols-outlined text-base">person</span>
            クリエイターページ
          </Link>
        )}
      </div>
    </div>
  );
}
