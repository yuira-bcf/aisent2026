import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getCreatorProfile,
  getCreatorStyle,
} from "@/lib/services/creator-profile-service";
import { flavors } from "@kyarainnovate/db/schema";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";

export default async function CreatorSettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [profile, style, flavorList] = await Promise.all([
    getCreatorProfile(session.user.id),
    getCreatorStyle(session.user.id),
    db.select().from(flavors).orderBy(flavors.sortOrder),
  ]);

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          設定
        </h1>
        <p className="text-sm text-gray-400">
          クリエータープロフィールが見つかりません。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          設定
        </h1>
        <p className="text-sm text-gray-400">プロフィール・スタイル設定</p>
      </div>
      <ProfileForm
        initialProfile={{
          displayName: profile.displayName,
          bio: profile.bio ?? "",
          specialties: profile.specialties ?? [],
          websiteUrl: profile.websiteUrl ?? "",
          socialLinks: {
            twitter:
              (profile.socialLinks as Record<string, string>)?.twitter ?? "",
            instagram:
              (profile.socialLinks as Record<string, string>)?.instagram ?? "",
          },
        }}
        initialStyle={{
          styleDescription: style?.styleDescription ?? "",
          stylePrompt: style?.stylePrompt ?? "",
          styleNoteBalance:
            (style?.styleNoteBalance as Record<string, number>) ?? null,
          styleFlavorPreferences:
            (style?.styleFlavorPreferences as Record<string, number>) ?? null,
        }}
        flavors={flavorList.map((f) => ({
          id: f.id,
          nameJa: f.nameJa,
          nameEn: f.nameEn,
          noteType: f.noteType,
        }))}
      />
    </div>
  );
}
