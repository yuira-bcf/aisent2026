"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceYen: number;
  imageUrl: string | null;
};

type Address = {
  id: string;
  label: string;
  recipientName: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  isDefault: boolean;
};

type NoteRatios = {
  top: number;
  middle: number;
  last: number;
};

const SIZE_OPTIONS = [
  { label: "30ml", multiplier: 1, defaultPrice: 4980 },
  { label: "50ml", multiplier: 1.6, defaultPrice: 7980 },
  { label: "100ml", multiplier: 2.57, defaultPrice: 12800 },
] as const;

import { NOTE_TYPE_COLORS as NOTE_COLORS } from "@/lib/colors";

const TAX_RATE = 0.1;

export default function OrderForm({
  blendRequestId,
  product,
  blendName,
  noteRatios,
  addresses,
}: {
  blendRequestId: string;
  product: Product;
  blendName: string;
  noteRatios: NoteRatios;
  addresses: Address[];
}) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePrice = product.priceYen;
  const sizeOption = SIZE_OPTIONS[selectedSize];
  const itemPrice = Math.round(basePrice * sizeOption.multiplier);
  const shippingFee = 0;
  const subtotal = itemPrice + shippingFee;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  const donutData = [
    { name: "TOP", value: noteRatios.top },
    { name: "MIDDLE", value: noteRatios.middle },
    { name: "LAST", value: noteRatios.last },
  ];

  async function handleSubmit() {
    if (!selectedAddressId) {
      setError("配送先を選択してください");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Add to cart
      const cartRes = await fetch("/api/v1/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
        }),
      });

      if (!cartRes.ok) {
        throw new Error("カートへの追加に失敗しました");
      }

      // Create order
      const orderRes = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddressId: selectedAddressId,
        }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json();
        throw new Error(data.error ?? "注文の作成に失敗しました");
      }

      const orderData = await orderRes.json();
      const orderId = orderData.data?.orderId;

      if (orderData.data?.stripeSessionUrl) {
        window.location.href = orderData.data.stripeSessionUrl;
      } else if (orderId) {
        router.push(`/orders/${orderId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "注文に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Product Card */}
      <div className="border border-gray-200 p-6">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 w-28">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {donutData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={NOTE_COLORS[entry.name as keyof typeof NOTE_COLORS]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-black">{blendName}</h2>
            <p className="text-xs text-gray-400 mt-1">{product.name}</p>
            {product.description && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                {product.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Size Selection */}
      <div className="border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-gray-400">
            straighten
          </span>
          サイズ選択
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {SIZE_OPTIONS.map((opt, i) => {
            const price = Math.round(basePrice * opt.multiplier);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedSize(i)}
                className={`border p-3 text-center transition ${
                  selectedSize === i
                    ? "border-black bg-gray-50"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-1">
                  ¥{price.toLocaleString()}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shipping Address */}
      <div className="border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-gray-400">
            local_shipping
          </span>
          配送先
        </h2>
        {addresses.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400 mb-3">
              配送先が登録されていません
            </p>
            <Link href="/addresses" className="text-sm text-black underline">
              配送先を追加
            </Link>
          </div>
        ) : (
          <>
            <select
              value={selectedAddressId}
              onChange={(e) => setSelectedAddressId(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} - {a.recipientName} ({a.prefecture}
                  {a.city})
                </option>
              ))}
            </select>
            <Link
              href="/addresses"
              className="text-xs text-gray-400 hover:text-black mt-2 inline-block"
            >
              配送先を追加・管理
            </Link>
          </>
        )}
      </div>

      {/* Order Summary */}
      <div className="border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4">
          注文サマリー
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">
              {blendName} ({sizeOption.label})
            </span>
            <span>¥{itemPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">送料</span>
            <span>¥{shippingFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">消費税(10%)</span>
            <span>¥{tax.toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between font-medium">
            <span>合計</span>
            <span className="text-lg">¥{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
          <span className="material-symbols-outlined text-base text-red-500">
            error
          </span>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || addresses.length === 0}
        className="w-full bg-black text-white py-3.5 text-sm font-medium tracking-wide hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <span className="material-symbols-outlined text-base animate-spin">
              autorenew
            </span>
            処理中...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-base">
              shopping_cart
            </span>
            注文を確定する
          </>
        )}
      </button>
    </div>
  );
}
