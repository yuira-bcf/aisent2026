"use client";

import { apiFetch } from "@/lib/api/client";
import { useState } from "react";

const SPECIALTY_OPTIONS = [
  "FLORAL",
  "WOODY",
  "CITRUS",
  "ORIENTAL",
  "FRESH",
  "GOURMAND",
];

type FlavorOption = {
  id: string;
  nameJa: string;
  nameEn: string;
  noteType: string;
};

type FlavorPref = {
  flavorId: string;
  bias: number;
};

type ProfileFormProps = {
  initialProfile: {
    displayName: string;
    bio: string;
    specialties: string[];
    websiteUrl: string;
    socialLinks: {
      twitter: string;
      instagram: string;
    };
  };
  initialStyle: {
    styleDescription: string;
    stylePrompt: string;
    styleNoteBalance: Record<string, number> | null;
    styleFlavorPreferences: Record<string, number> | null;
  };
  flavors?: FlavorOption[];
};

export function ProfileForm({
  initialProfile,
  initialStyle,
  flavors,
}: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [bio, setBio] = useState(initialProfile.bio);
  const [specialties, setSpecialties] = useState<string[]>(
    initialProfile.specialties,
  );
  const [twitter, setTwitter] = useState(initialProfile.socialLinks.twitter);
  const [instagram, setInstagram] = useState(
    initialProfile.socialLinks.instagram,
  );
  const [styleDescription, setStyleDescription] = useState(
    initialStyle.styleDescription,
  );
  const [stylePrompt, setStylePrompt] = useState(initialStyle.stylePrompt);

  // Note balance state
  const [topBias, setTopBias] = useState(
    initialStyle.styleNoteBalance?.topBias ?? 0,
  );
  const [middleBias, setMiddleBias] = useState(
    initialStyle.styleNoteBalance?.middleBias ?? 0,
  );
  const [lastBias, setLastBias] = useState(
    initialStyle.styleNoteBalance?.lastBias ?? 0,
  );

  // Flavor preferences state
  const [flavorPrefs, setFlavorPrefs] = useState<FlavorPref[]>(() => {
    if (!initialStyle.styleFlavorPreferences) return [];
    return Object.entries(initialStyle.styleFlavorPreferences).map(
      ([flavorId, bias]) => ({ flavorId, bias }),
    );
  });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function toggleSpecialty(s: string) {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  function addFlavorPref() {
    if (!flavors) return;
    const available = flavors.filter(
      (f) => !flavorPrefs.some((p) => p.flavorId === f.id),
    );
    if (available.length === 0) return;
    setFlavorPrefs((prev) => [...prev, { flavorId: available[0].id, bias: 0 }]);
  }

  function removeFlavorPref(index: number) {
    setFlavorPrefs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFlavorPrefId(index: number, flavorId: string) {
    setFlavorPrefs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, flavorId } : p)),
    );
  }

  function updateFlavorPrefBias(index: number, bias: number) {
    setFlavorPrefs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, bias } : p)),
    );
  }

  function getFlavorName(flavorId: string): string {
    const f = flavors?.find((fl) => fl.id === flavorId);
    return f ? f.nameJa : flavorId;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const socialLinks: Record<string, string> = {};
      if (twitter) socialLinks.twitter = twitter;
      if (instagram) socialLinks.instagram = instagram;

      // Save profile
      await apiFetch("/api/v1/creator/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName,
          bio: bio || undefined,
          specialties: specialties.length > 0 ? specialties : undefined,
          socialLinks:
            Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
        }),
      });

      // Save style
      await apiFetch("/api/v1/creator/style", {
        method: "PUT",
        body: JSON.stringify({
          styleDescription: styleDescription || undefined,
          stylePrompt: stylePrompt || undefined,
          styleNoteBalance: {
            topBias,
            middleBias,
            lastBias,
          },
          styleFlavorPreferences:
            flavorPrefs.length > 0 ? flavorPrefs : undefined,
        }),
      });

      showToast("success", "保存しました");
    } catch {
      showToast("error", "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 text-sm z-50 ${
            toast.type === "success"
              ? "bg-black text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Profile Section */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-black mb-4">プロフィール</h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="input-displayName"
              className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
            >
              表示名
            </label>
            <input
              id="input-displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
              required
            />
          </div>

          <div>
            <label
              htmlFor="input-bio"
              className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
            >
              自己紹介
            </label>
            <textarea
              id="input-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full resize-none"
            />
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
              専門分野
            </p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialty(s)}
                  className={`px-3 py-1 text-xs font-medium transition ${
                    specialties.includes(s)
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-twitter"
                className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
              >
                Twitter URL
              </label>
              <input
                id="input-twitter"
                type="url"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="https://twitter.com/..."
                className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
              />
            </div>
            <div>
              <label
                htmlFor="input-instagram"
                className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
              >
                Instagram URL
              </label>
              <input
                id="input-instagram"
                type="url"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/..."
                className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Style Section */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-black mb-4">スタイル設定</h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="input-styleDescription"
              className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
            >
              スタイル説明
            </label>
            <textarea
              id="input-styleDescription"
              value={styleDescription}
              onChange={(e) => setStyleDescription(e.target.value)}
              rows={3}
              className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full resize-none"
              placeholder="あなたのブレンドスタイルを説明..."
            />
          </div>

          <div>
            <label
              htmlFor="input-stylePrompt"
              className="text-xs text-gray-400 uppercase tracking-wide mb-1 block"
            >
              スタイルプロンプト
            </label>
            <textarea
              id="input-stylePrompt"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              rows={3}
              className="border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none w-full resize-none"
              placeholder="AIブレンドに影響するプロンプト..."
            />
          </div>

          {/* Note Balance Sliders */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 block">
              ノートバランス
            </p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">TOP傾向</span>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {topBias > 0 ? "+" : ""}
                    {topBias.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-0.3}
                  max={0.3}
                  step={0.01}
                  value={topBias}
                  onChange={(e) => setTopBias(Number(e.target.value))}
                  className="w-full accent-black"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">MIDDLE傾向</span>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {middleBias > 0 ? "+" : ""}
                    {middleBias.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-0.3}
                  max={0.3}
                  step={0.01}
                  value={middleBias}
                  onChange={(e) => setMiddleBias(Number(e.target.value))}
                  className="w-full accent-black"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">LAST傾向</span>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {lastBias > 0 ? "+" : ""}
                    {lastBias.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-0.3}
                  max={0.3}
                  step={0.01}
                  value={lastBias}
                  onChange={(e) => setLastBias(Number(e.target.value))}
                  className="w-full accent-black"
                />
              </div>
            </div>
          </div>

          {/* Flavor Preferences */}
          {flavors && flavors.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 block">
                フレーバー傾向
              </p>
              <div className="space-y-2">
                {flavorPrefs.map((pref, index) => (
                  <div
                    key={`${pref.flavorId}-${index}`}
                    className="flex items-center gap-3 border border-gray-100 p-2"
                  >
                    <select
                      value={pref.flavorId}
                      onChange={(e) =>
                        updateFlavorPrefId(index, e.target.value)
                      }
                      className="border border-gray-200 px-2 py-1 text-xs focus:border-black focus:outline-none flex-1"
                    >
                      {flavors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nameJa} ({f.noteType})
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="range"
                        min={-0.5}
                        max={0.5}
                        step={0.01}
                        value={pref.bias}
                        onChange={(e) =>
                          updateFlavorPrefBias(index, Number(e.target.value))
                        }
                        className="w-full accent-black"
                      />
                      <span className="text-xs text-gray-400 tabular-nums w-12 text-right">
                        {pref.bias > 0 ? "+" : ""}
                        {pref.bias.toFixed(2)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFlavorPref(index)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <span className="material-symbols-outlined text-sm">
                        close
                      </span>
                    </button>
                  </div>
                ))}
              </div>
              {flavorPrefs.length < 10 && (
                <button
                  type="button"
                  onClick={addFlavorPref}
                  className="mt-2 text-xs text-gray-500 hover:text-black transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  フレーバーを追加
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
