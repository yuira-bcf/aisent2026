import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  creatorFlavorNotes,
  flavorCompatibility,
  prohibitedCombinations,
  signatureRecipes,
  themeAxes,
} from "@kyarainnovate/db/schema";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DataDashboard } from "./data-dashboard";

export default async function DataInputPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [
    flavorNotesCount,
    prohibitedCount,
    compatibilityCount,
    themeCount,
    recipeCount,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(creatorFlavorNotes)
      .where(eq(creatorFlavorNotes.creatorId, userId))
      .then((r) => r[0].count),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(prohibitedCombinations)
      .where(eq(prohibitedCombinations.creatorId, userId))
      .then((r) => r[0].count),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(flavorCompatibility)
      .where(eq(flavorCompatibility.creatorId, userId))
      .then((r) => r[0].count),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeAxes)
      .where(eq(themeAxes.creatorId, userId))
      .then((r) => r[0].count),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(signatureRecipes)
      .where(eq(signatureRecipes.creatorId, userId))
      .then((r) => r[0].count),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          データ入力
        </h1>
        <p className="text-sm text-gray-400">
          5層アーキテクチャに基づく香り創作データ
        </p>
      </div>
      <DataDashboard
        counts={{
          flavorNotes: flavorNotesCount,
          prohibited: prohibitedCount,
          compatibility: compatibilityCount,
          theme: themeCount,
          recipes: recipeCount,
        }}
      />
    </div>
  );
}
