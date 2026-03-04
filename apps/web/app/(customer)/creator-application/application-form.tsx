"use client";

import { apiFetch } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/client";
import { useState } from "react";

const SPECIALTY_OPTIONS = [
  { value: "FLORAL", label: "フローラル" },
  { value: "WOODY", label: "ウッディ" },
  { value: "CITRUS", label: "シトラス" },
  { value: "ORIENTAL", label: "オリエンタル" },
  { value: "FRESH", label: "フレッシュ" },
  { value: "GOURMAND", label: "グルマン" },
] as const;

export function ApplicationForm() {
  const [displayName, setDisplayName] = useState("");
  const [creatorIdSlug, setCreatorIdSlug] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [motivation, setMotivation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function toggleSpecialty(value: string) {
    setSpecialties((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : prev.length < 5
          ? [...prev, value]
          : prev,
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!/^[a-z0-9_]{3,20}$/.test(creatorIdSlug)) {
      setError(
        "クリエイターIDは半角英小文字・数字・アンダースコアのみ（3〜20文字）",
      );
      return;
    }
    if (specialties.length === 0) {
      setError("得意分野を1つ以上選択してください");
      return;
    }
    if (bio.length < 10) {
      setError("自己紹介は10文字以上で入力してください");
      return;
    }
    if (motivation.length < 50) {
      setError("志望動機は50文字以上で入力してください");
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/api/v1/creator/application", {
        method: "POST",
        body: JSON.stringify({
          displayName,
          creatorIdSlug,
          bio,
          specialties,
          portfolioDescription: portfolioDescription || undefined,
          motivation,
        }),
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("送信に失敗しました。しばらくしてからお試しください。");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="border border-gray-200 p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-black mb-3 block">
          task_alt
        </span>
        <h2 className="text-lg font-bold text-black mb-2">
          申請を送信しました
        </h2>
        <p className="text-sm text-gray-500">
          審査には数日かかる場合があります。結果はメールでお知らせします。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border border-gray-200 p-6 space-y-5">
        <div>
          <label
            htmlFor="displayName"
            className="text-xs font-medium text-gray-500 block mb-1"
          >
            表示名
          </label>
          <input
            id="displayName"
            type="text"
            required
            minLength={2}
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none"
            placeholder="表示される名前"
          />
        </div>

        <div>
          <label
            htmlFor="creatorIdSlug"
            className="text-xs font-medium text-gray-500 block mb-1"
          >
            クリエイターID
          </label>
          <input
            id="creatorIdSlug"
            type="text"
            required
            value={creatorIdSlug}
            onChange={(e) => setCreatorIdSlug(e.target.value.toLowerCase())}
            className="w-full border border-gray-200 px-3 py-2.5 text-sm font-mono focus:border-black focus:outline-none"
            placeholder="your_creator_id"
          />
          <p className="mt-1 text-xs text-gray-400">
            半角英小文字・数字・アンダースコアのみ（3〜20文字）
          </p>
        </div>

        <div>
          <label
            htmlFor="bio"
            className="text-xs font-medium text-gray-500 block mb-1"
          >
            自己紹介
          </label>
          <textarea
            id="bio"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none resize-none"
            placeholder="あなたの香りに対する想いや経験を教えてください（10文字以上）"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">
            {bio.length}/1000
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 block mb-2">
            得意分野（1〜5つ選択）
          </p>
          <div className="flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map((option) => {
              const selected = specialties.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleSpecialty(option.value)}
                  className={`px-3 py-1.5 text-xs border transition ${
                    selected
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="portfolioDescription"
            className="text-xs font-medium text-gray-500 block mb-1"
          >
            ポートフォリオ（任意）
          </label>
          <textarea
            id="portfolioDescription"
            maxLength={2000}
            rows={3}
            value={portfolioDescription}
            onChange={(e) => setPortfolioDescription(e.target.value)}
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none resize-none"
            placeholder="過去の作品や経歴があればご記入ください"
          />
        </div>

        <div>
          <label
            htmlFor="motivation"
            className="text-xs font-medium text-gray-500 block mb-1"
          >
            志望動機
          </label>
          <textarea
            id="motivation"
            required
            minLength={50}
            maxLength={500}
            rows={4}
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:border-black focus:outline-none resize-none"
            placeholder="KyaraInnovateでクリエイターとして活動したい理由を教えてください（50文字以上）"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">
            {motivation.length}/500
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
          <span className="material-symbols-outlined text-base text-red-500">
            error
          </span>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-40"
      >
        {loading ? "送信中..." : "申請を送信"}
      </button>
    </form>
  );
}
