import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signatureRecipes } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductPublishForm } from "./product-publish-form";

export default async function CreatorNewProductPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Get creator's published recipes for auto-fill
  const recipes = await db
    .select({ id: signatureRecipes.id, name: signatureRecipes.name })
    .from(signatureRecipes)
    .where(
      and(
        eq(signatureRecipes.creatorId, session.user.id),
        eq(signatureRecipes.status, "PUBLISHED"),
      ),
    );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <Link
          href="/creator/products"
          className="text-xs text-gray-400 hover:text-black transition flex items-center gap-0.5 mb-4"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          出品管理に戻る
        </Link>
        <h1 className="text-2xl font-bold">新規出品</h1>
        <p className="text-sm text-gray-400">新しい商品を出品します</p>
      </div>
      <ProductPublishForm recipes={recipes} />
    </div>
  );
}
