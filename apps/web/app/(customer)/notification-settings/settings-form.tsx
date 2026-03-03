"use client";

import { apiFetch } from "@/lib/api/client";
import { useEffect, useState } from "react";

type Preferences = {
  emailOrderUpdates: boolean;
  emailReviews: boolean;
  emailRoyalty: boolean;
  emailSystem: boolean;
};

const TOGGLE_GROUPS = [
  {
    key: "emailOrderUpdates" as const,
    label: "注文関連メール",
    description: "注文確認・発送・配達・キャンセルの通知",
    types: ["注文確認", "注文発送", "注文配達", "注文キャンセル"],
  },
  {
    key: "emailReviews" as const,
    label: "レビューメール",
    description: "レビュー受信の通知",
    types: ["レビュー受信"],
  },
  {
    key: "emailRoyalty" as const,
    label: "ロイヤリティメール",
    description: "ロイヤリティ支払い・ティア変更の通知",
    types: ["ロイヤリティ支払い", "ティア変更"],
  },
  {
    key: "emailSystem" as const,
    label: "システムメール",
    description: "システム通知・クリエイター承認/却下・レシピ注文の通知",
    types: [
      "システム通知",
      "クリエイター承認",
      "クリエイター却下",
      "レシピ注文",
    ],
  },
] as const;

export default function SettingsForm() {
  const [prefs, setPrefs] = useState<Preferences>({
    emailOrderUpdates: true,
    emailReviews: true,
    emailRoyalty: true,
    emailSystem: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    apiFetch<{ preferences: Preferences }>("/api/v1/notifications/preferences")
      .then(({ preferences }) => {
        setPrefs({
          emailOrderUpdates: preferences.emailOrderUpdates,
          emailReviews: preferences.emailReviews,
          emailRoyalty: preferences.emailRoyalty,
          emailSystem: preferences.emailSystem,
        });
      })
      .catch(() => {
        // Use defaults
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/v1/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify(prefs),
      });
      showToast("success", "通知設定を保存しました");
    } catch {
      showToast("error", "通知設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const allEnabled = Object.values(prefs).every(Boolean);

  function toggleAll() {
    const newValue = !allEnabled;
    setPrefs({
      emailOrderUpdates: newValue,
      emailReviews: newValue,
      emailRoyalty: newValue,
      emailSystem: newValue,
    });
  }

  if (loading) {
    return (
      <div className="border border-gray-200 p-12 text-center">
        <span className="material-symbols-outlined text-2xl text-gray-300 animate-spin">
          autorenew
        </span>
      </div>
    );
  }

  return (
    <>
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

      <form onSubmit={handleSave}>
        {/* Global toggle */}
        <div className="border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-black">メール通知</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                すべてのメール通知を一括で切り替え
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                allEnabled ? "bg-black" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  allEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Individual toggles */}
        <div className="border border-gray-200 divide-y divide-gray-100">
          {TOGGLE_GROUPS.map((group) => (
            <div key={group.key} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-black">
                    {group.label}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {group.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {group.types.map((t) => (
                      <span
                        key={t}
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({ ...p, [group.key]: !p[group.key] }))
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${
                    prefs[group.key] ? "bg-black" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      prefs[group.key] ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
          >
            {saving ? "保存中..." : "設定を保存"}
          </button>
        </div>
      </form>
    </>
  );
}
