import { db } from "@/lib/db";
import { aiBlendRules } from "@kyarainnovate/db/schema";
import { desc } from "drizzle-orm";
import { AiRulesManager } from "./ai-rules-manager";

export default async function AdminAiRulesPage() {
  const rules = await db
    .select()
    .from(aiBlendRules)
    .orderBy(desc(aiBlendRules.priority));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          AIブレンドルール
        </h1>
        <p className="text-sm text-gray-400">
          AIブレンド基本ルールの追加・編集・削除
        </p>
      </div>
      <AiRulesManager initialRules={rules} />
    </div>
  );
}
