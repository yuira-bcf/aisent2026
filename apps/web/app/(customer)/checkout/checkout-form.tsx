"use client";

import { apiFetch } from "@/lib/api/client";
import Link from "next/link";
import { useState } from "react";

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

type CreateOrderResponse = {
  orderId: string;
  stripeSessionUrl: string;
};

export default function CheckoutForm({
  addresses,
}: {
  addresses: Address[];
}) {
  // Default to the default address, or the first one
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [selectedId, setSelectedId] = useState<string>(
    defaultAddress?.id ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await apiFetch<CreateOrderResponse>("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify({ shippingAddressId: selectedId }),
      });

      // Redirect to Stripe Checkout
      window.location.href = result.stripeSessionUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "注文の作成に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Shipping address selection */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-gray-400">
            local_shipping
          </span>
          配送先
        </h2>

        {addresses.length === 0 ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-3xl text-gray-300 mb-2 block">
              location_on
            </span>
            <p className="text-sm text-gray-400 mb-4">
              配送先が登録されていません
            </p>
            <Link
              href="/addresses"
              className="inline-block px-6 py-2.5 text-sm bg-black text-white hover:bg-gray-800 transition"
            >
              配送先を追加
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <label
                key={address.id}
                className={`block border p-4 cursor-pointer transition ${
                  selectedId === address.id
                    ? "border-black"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="shippingAddressId"
                    value={address.id}
                    checked={selectedId === address.id}
                    onChange={() => setSelectedId(address.id)}
                    className="mt-1 accent-black"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-black">
                        {address.label}
                      </span>
                      {address.isDefault && (
                        <span className="text-xs bg-black text-white px-2 py-0.5">
                          デフォルト
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 text-sm text-gray-600">
                      <p>{address.recipientName}</p>
                      <p>
                        〒{address.postalCode} {address.prefecture}
                        {address.city}
                        {address.addressLine1}
                        {address.addressLine2 ? ` ${address.addressLine2}` : ""}
                      </p>
                      <p className="text-gray-400">{address.phone}</p>
                    </div>
                  </div>
                </div>
              </label>
            ))}

            <Link
              href="/addresses"
              className="block w-full border border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-black hover:text-black transition text-center flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-base">add</span>
              新規配送先を追加
            </Link>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !selectedId || addresses.length === 0}
        className="w-full bg-black text-white py-3.5 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
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
            <span className="material-symbols-outlined text-base text-amber-300">
              lock
            </span>
            注文を確定する
          </>
        )}
      </button>

      <Link
        href="/cart"
        className="block mt-3 w-full border border-gray-200 py-3 text-sm text-center text-gray-600 hover:border-black transition"
      >
        カートに戻る
      </Link>
    </form>
  );
}
