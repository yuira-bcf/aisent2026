import { db } from "@/lib/db";
import { products } from "@kyarainnovate/db/schema";
import { desc } from "drizzle-orm";
import { ProductsManager } from "./products-manager";

export default async function AdminProductsPage() {
  const allProducts = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          商品管理
        </h1>
        <p className="text-sm text-gray-400">商品の追加・編集・削除</p>
      </div>
      <ProductsManager initialProducts={allProducts} />
    </div>
  );
}
