import { db } from "@/lib/db";
import {
  flavors,
  keywordFlavorRules,
  keywords,
} from "@kyarainnovate/db/schema";
import { asc, isNull } from "drizzle-orm";
import { RuleMatrixEditor } from "./rule-matrix-editor";

export default async function AdminRuleMatrixPage() {
  const [allKeywords, allFlavors, baseRules] = await Promise.all([
    db.select().from(keywords).orderBy(asc(keywords.word)),
    db.select().from(flavors).orderBy(asc(flavors.sortOrder)),
    db
      .select()
      .from(keywordFlavorRules)
      .where(isNull(keywordFlavorRules.creatorId)),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          ルールマトリクス
        </h1>
        <p className="text-sm text-gray-400">
          キーワードと香料のベースルール重み設定
        </p>
      </div>
      <RuleMatrixEditor
        initialKeywords={allKeywords}
        initialFlavors={allFlavors}
        initialRules={baseRules}
      />
    </div>
  );
}
