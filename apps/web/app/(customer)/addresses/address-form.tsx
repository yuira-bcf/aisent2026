"use client";

import { apiFetch } from "@/lib/api/client";
import { useState } from "react";

const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

type Address = {
  id: string;
  label: string;
  recipientName: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string | null;
  phone: string;
  isDefault: boolean;
};

type FormData = {
  label: string;
  recipientName: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  isDefault: boolean;
};

export default function AddressForm({
  address,
  onSuccess,
  onCancel,
}: {
  address: Address | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = address !== null;

  const [form, setForm] = useState<FormData>({
    label: address?.label ?? "",
    recipientName: address?.recipientName ?? "",
    postalCode: address?.postalCode ?? "",
    prefecture: address?.prefecture ?? "",
    city: address?.city ?? "",
    addressLine1: address?.addressLine1 ?? "",
    addressLine2: address?.addressLine2 ?? "",
    phone: address?.phone ?? "",
    isDefault: address?.isDefault ?? false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const body = {
        ...form,
        addressLine2: form.addressLine2 || undefined,
      };

      if (isEditing) {
        await apiFetch(`/api/v1/shipping-addresses/${address.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/v1/shipping-addresses", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 p-8 space-y-6"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-black">
          {isEditing ? "配送先を編集" : "新規配送先を追加"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-black transition"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      {/* Label */}
      <div>
        <label className={labelClass}>ラベル</label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => updateField("label", e.target.value)}
          placeholder="自宅、職場 など"
          required
          className={inputClass}
        />
      </div>

      {/* Recipient name */}
      <div>
        <label className={labelClass}>受取人氏名</label>
        <input
          type="text"
          value={form.recipientName}
          onChange={(e) => updateField("recipientName", e.target.value)}
          placeholder="山田 太郎"
          required
          className={inputClass}
        />
      </div>

      {/* Postal code + Prefecture row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>郵便番号</label>
          <input
            type="text"
            value={form.postalCode}
            onChange={(e) => updateField("postalCode", e.target.value)}
            placeholder="123-4567"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>都道府県</label>
          <select
            value={form.prefecture}
            onChange={(e) => updateField("prefecture", e.target.value)}
            required
            className={inputClass}
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* City */}
      <div>
        <label className={labelClass}>市区町村</label>
        <input
          type="text"
          value={form.city}
          onChange={(e) => updateField("city", e.target.value)}
          placeholder="渋谷区"
          required
          className={inputClass}
        />
      </div>

      {/* Address line 1 */}
      <div>
        <label className={labelClass}>番地</label>
        <input
          type="text"
          value={form.addressLine1}
          onChange={(e) => updateField("addressLine1", e.target.value)}
          placeholder="神南1-2-3"
          required
          className={inputClass}
        />
      </div>

      {/* Address line 2 */}
      <div>
        <label className={labelClass}>
          建物名・部屋番号
          <span className="text-gray-300 ml-1">（任意）</span>
        </label>
        <input
          type="text"
          value={form.addressLine2}
          onChange={(e) => updateField("addressLine2", e.target.value)}
          placeholder="ABCマンション 101号室"
          className={inputClass}
        />
      </div>

      {/* Phone */}
      <div>
        <label className={labelClass}>電話番号</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          placeholder="090-1234-5678"
          required
          className={inputClass}
        />
      </div>

      {/* Default checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => updateField("isDefault", e.target.checked)}
          className="accent-black"
        />
        <span className="text-sm text-gray-600">
          デフォルトの配送先に設定する
        </span>
      </label>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
          <span className="material-symbols-outlined text-base text-red-500">
            error
          </span>
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-black text-white py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-sm animate-spin">
                autorenew
              </span>
              保存中...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">save</span>
              {isEditing ? "更新する" : "追加する"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-3 text-sm border border-gray-200 hover:border-black transition disabled:opacity-40"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
