import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  orderItems,
  orders,
  products,
  recipeReviews,
  signatureRecipes,
} from "@kyarainnovate/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReviewForm from "./review-form";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  // Fetch order with ownership check
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.userId, session.user.id)),
    with: { items: true },
  });

  if (!order) notFound();

  // Only DELIVERED orders can be reviewed
  if (order.status !== "DELIVERED") {
    redirect(`/orders/${id}`);
  }

  // Find recipe IDs from order items via products
  const productIds = order.items.map((item) => item.productId);
  const productRows =
    productIds.length > 0
      ? await db
          .select({ id: products.id, recipeId: products.recipeId })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];

  const recipeIds = productRows
    .map((p) => p.recipeId)
    .filter((rid): rid is string => rid != null);

  if (recipeIds.length === 0) {
    // No recipes linked to this order's products
    redirect(`/orders/${id}`);
  }

  // For now, review the first recipe found
  const recipeId = recipeIds[0];

  // Check if already reviewed
  const existingReview = await db
    .select({ id: recipeReviews.id })
    .from(recipeReviews)
    .where(
      and(eq(recipeReviews.orderId, id), eq(recipeReviews.recipeId, recipeId)),
    );

  if (existingReview.length > 0) {
    redirect(`/orders/${id}`);
  }

  // Get recipe name
  const [recipe] = await db
    .select({ name: signatureRecipes.name })
    .from(signatureRecipes)
    .where(eq(signatureRecipes.id, recipeId));

  if (!recipe) {
    redirect(`/orders/${id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            レビューを書く
          </h1>
          <p className="text-sm text-gray-400">注文 {id.slice(0, 8)}</p>
        </div>
        <Link
          href={`/orders/${id}`}
          className="text-sm text-gray-400 hover:text-black transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">
            arrow_back
          </span>
          注文詳細へ
        </Link>
      </div>

      <ReviewForm orderId={id} recipeId={recipeId} recipeName={recipe.name} />
    </div>
  );
}
