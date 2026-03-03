import { db } from "@/lib/db";
import { coupons } from "@kyarainnovate/db/schema";
import { desc } from "drizzle-orm";
import { CouponsManager } from "./coupons-manager";

export default async function AdminCouponsPage() {
  const allCoupons = await db
    .select()
    .from(coupons)
    .orderBy(desc(coupons.createdAt));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          クーポン管理
        </h1>
        <p className="text-sm text-gray-400">クーポンの追加・編集・削除</p>
      </div>
      <CouponsManager initialCoupons={allCoupons} />
    </div>
  );
}
