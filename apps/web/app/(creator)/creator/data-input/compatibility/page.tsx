import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompatibilitySwipe } from "./compatibility-swipe";

export default async function CompatibilityPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          相性スコア入力
        </h1>
        <p className="text-sm text-gray-400">
          香料ペアの相性をスワイプ形式で評価
        </p>
      </div>
      <CompatibilitySwipe />
    </div>
  );
}
