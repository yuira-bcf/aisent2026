"use client";

import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EcSettingsData = {
  shippingFeeYen: number;
  taxRate: string;
  freeShippingThresholdYen: number;
  paymentProvider: string;
};

const PAYMENT_PROVIDERS = [
  { label: "Stripe", value: "stripe" },
  { label: "PayPay", value: "paypay" },
  { label: "Manual", value: "manual" },
];

export function EcSettingsForm({ initial }: { initial: EcSettingsData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    shippingFeeYen: initial.shippingFeeYen,
    taxRate: Number(initial.taxRate),
    freeShippingThresholdYen: initial.freeShippingThresholdYen,
    paymentProvider: initial.paymentProvider,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/api/v1/admin/ec-settings", {
        method: "PUT",
        body: JSON.stringify({
          shippingFeeYen: form.shippingFeeYen,
          taxRate: form.taxRate,
          freeShippingThresholdYen: form.freeShippingThresholdYen,
          paymentProvider: form.paymentProvider,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1">送料 (円)</label>
          <input
            type="number"
            min={0}
            value={form.shippingFeeYen}
            onChange={(e) =>
              setForm({
                ...form,
                shippingFeeYen: Number.parseInt(e.target.value) || 0,
              })
            }
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            送料無料しきい値 (円)
          </label>
          <input
            type="number"
            min={0}
            value={form.freeShippingThresholdYen}
            onChange={(e) =>
              setForm({
                ...form,
                freeShippingThresholdYen: Number.parseInt(e.target.value) || 0,
              })
            }
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            注文合計がこの金額以上の場合、送料無料になります
          </p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">税率 (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.taxRate}
            onChange={(e) =>
              setForm({
                ...form,
                taxRate: Number.parseFloat(e.target.value) || 0,
              })
            }
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            決済プロバイダ
          </label>
          <select
            value={form.paymentProvider}
            onChange={(e) =>
              setForm({ ...form, paymentProvider: e.target.value })
            }
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
          >
            {PAYMENT_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-6 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600">保存しました</span>
        )}
      </div>
    </form>
  );
}
