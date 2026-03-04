import { db } from "@/lib/db";
import { getActiveCreators } from "@/lib/services/creator-profile-service";
import { getPublishedRecipes } from "@/lib/services/recipe-service";
import { keywords } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import BlendForm from "./blend-form";
import BlendModeTabs from "./blend-mode-tabs";
import ChatBlend from "./chat-blend";

export default async function BlendPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string }>;
}) {
  const { creator: creatorSlug } = await searchParams;

  const [presetKeywords, creatorsResult, recipesResult] = await Promise.all([
    db
      .select({
        id: keywords.id,
        word: keywords.word,
        category: keywords.category,
        isPreset: keywords.isPreset,
      })
      .from(keywords)
      .where(eq(keywords.isPreset, true)),
    getActiveCreators(1, 50),
    getPublishedRecipes(1, 20),
  ]);

  const creatorOptions = creatorsResult.items.map((c) => ({
    userId: c.userId,
    displayName: c.displayName,
    creatorIdSlug: c.creatorIdSlug,
    tier: c.tier,
  }));

  const recipeOptions = recipesResult.items.map((r) => ({
    id: r.id,
    name: r.name,
    creatorName: r.creatorName,
    description: r.subTheme ?? null,
  }));

  // Resolve creatorSlug to userId for ChatBlend
  const creatorForChat = creatorSlug
    ? creatorOptions.find((c) => c.creatorIdSlug === creatorSlug)
    : undefined;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <BlendModeTabs
        formContent={
          <BlendForm
            presetKeywords={presetKeywords}
            creators={creatorOptions}
            initialCreatorSlug={creatorSlug}
            recipes={recipeOptions}
          />
        }
        chatContent={<ChatBlend creatorId={creatorForChat?.userId} />}
      />
    </div>
  );
}
