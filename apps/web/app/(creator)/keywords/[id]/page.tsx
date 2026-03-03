import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  flavors,
  keywordFlavorRules,
  keywords,
} from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import RuleEditor from "./rule-editor";

export default async function KeywordRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const keyword = await db.query.keywords.findFirst({
    where: eq(keywords.id, id),
  });

  if (!keyword) notFound();

  const existingRules = await db
    .select({
      id: keywordFlavorRules.id,
      flavorId: keywordFlavorRules.flavorId,
      weight: keywordFlavorRules.weight,
      noteType: keywordFlavorRules.noteType,
    })
    .from(keywordFlavorRules)
    .where(
      and(
        eq(keywordFlavorRules.keywordId, id),
        eq(keywordFlavorRules.creatorId, session.user.id),
      ),
    );

  const allFlavors = await db.select().from(flavors).orderBy(flavors.sortOrder);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/keywords"
          className="text-gray-400 hover:text-black transition"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            ルール編集
          </h1>
          <p className="text-sm text-gray-400">
            キーワード: {keyword.word} ({keyword.category})
          </p>
        </div>
      </div>

      <RuleEditor
        keywordId={id}
        existingRules={existingRules.map((r) => ({
          flavorId: r.flavorId,
          weight: Number.parseFloat(r.weight),
          noteType: r.noteType,
        }))}
        allFlavors={allFlavors.map((f) => ({
          id: f.id,
          nameJa: f.nameJa,
          nameEn: f.nameEn,
          noteType: f.noteType,
        }))}
      />
    </div>
  );
}
