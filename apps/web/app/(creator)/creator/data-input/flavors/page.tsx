import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { flavors } from "@kyarainnovate/db/schema";
import { redirect } from "next/navigation";
import { FlavorNotesManager } from "./flavor-notes-manager";

export default async function FlavorNotesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const flavorList = await db
    .select({
      id: flavors.id,
      nameJa: flavors.nameJa,
      nameEn: flavors.nameEn,
      noteType: flavors.noteType,
    })
    .from(flavors)
    .orderBy(flavors.sortOrder);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          香料物性データ
        </h1>
        <p className="text-sm text-gray-400">
          各香料にクリエイター独自の物性を登録
        </p>
      </div>
      <FlavorNotesManager flavors={flavorList} />
    </div>
  );
}
