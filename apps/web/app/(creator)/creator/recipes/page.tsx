import { auth } from "@/lib/auth";
import { getRecipesByCreator } from "@/lib/services/recipe-service";
import Link from "next/link";
import { redirect } from "next/navigation";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  DRAFT: { text: "下書き", className: "bg-gray-100 text-gray-600" },
  PUBLISHED: { text: "公開中", className: "bg-black text-white" },
  ARCHIVED: { text: "アーカイブ", className: "bg-gray-300 text-gray-500" },
};

export default async function RecipesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { items, total } = await getRecipesByCreator(session.user.id, 1, 50);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            レシピ
          </h1>
          <p className="text-sm text-gray-400">{total} 件</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/creator/recipes/new-advanced"
            className="px-4 py-2 text-sm border border-gray-200 text-gray-700 hover:border-black transition flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">
              auto_awesome
            </span>
            高度な作成
          </Link>
          <Link
            href="/creator/recipes/new"
            className="px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            新規作成
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">
            science
          </span>
          <p className="text-sm text-gray-400">
            まだレシピがありません。最初のレシピを作成しましょう。
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 divide-y divide-gray-100">
          {items.map((recipe) => {
            const status = STATUS_LABEL[recipe.status] ?? STATUS_LABEL.DRAFT;
            return (
              <div
                key={recipe.id}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/creator/recipes/${recipe.id}/edit`}
                      className="text-sm font-medium text-black hover:underline truncate"
                    >
                      {recipe.name}
                    </Link>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium ${status.className}`}
                    >
                      {status.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {recipe.price30ml && (
                      <span>30ml: {recipe.price30ml.toLocaleString()}円</span>
                    )}
                    {recipe.price50ml && (
                      <span>50ml: {recipe.price50ml.toLocaleString()}円</span>
                    )}
                    {recipe.rating !== null && (
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs">
                          star
                        </span>
                        {recipe.rating.toFixed(1)}
                      </span>
                    )}
                    <span>注文: {recipe.orderCount}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {recipe.status === "DRAFT" && (
                    <PublishButton recipeId={recipe.id} />
                  )}
                  <Link
                    href={`/creator/recipes/${recipe.id}/edit`}
                    className="text-gray-400 hover:text-black transition"
                  >
                    <span className="material-symbols-outlined text-lg">
                      edit
                    </span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PublishButton({ recipeId }: { recipeId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { auth: getAuth } = await import("@/lib/auth");
        const session = await getAuth();
        if (!session) return;
        const { publishRecipe } = await import("@/lib/services/recipe-service");
        await publishRecipe(session.user.id, recipeId);
        const { revalidatePath } = await import("next/cache");
        revalidatePath("/creator/recipes");
      }}
    >
      <button
        type="submit"
        className="px-3 py-1 text-xs bg-black text-white hover:bg-gray-800 transition"
      >
        公開
      </button>
    </form>
  );
}
