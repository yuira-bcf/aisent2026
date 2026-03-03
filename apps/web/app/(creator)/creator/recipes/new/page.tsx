import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { flavors } from "@kyarainnovate/db/schema";
import { redirect } from "next/navigation";
import { RecipeForm } from "../recipe-form";

export default async function NewRecipePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const flavorList = await db.select().from(flavors).orderBy(flavors.sortOrder);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          新規レシピ
        </h1>
        <p className="text-sm text-gray-400">レシピを作成</p>
      </div>
      <RecipeForm
        mode="create"
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
