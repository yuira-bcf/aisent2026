"use client";

import { apiFetch } from "@/lib/api/client";
import type { Cart } from "@/lib/services/cart-service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CartView({ initialCart }: { initialCart: Cart }) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    couponId: string;
    discountYen: number;
  } | null>(null);

  async function updateQuantity(itemId: string, quantity: number) {
    setLoadingId(itemId);
    try {
      const result = await apiFetch<{ cart: Cart }>(
        `/api/v1/cart/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        },
      );
      setCart(result.cart);
      router.refresh();
    } catch {
      // Silently handle
    } finally {
      setLoadingId(null);
    }
  }

  async function removeItem(itemId: string) {
    setLoadingId(itemId);
    try {
      const result = await apiFetch<{ cart: Cart }>(
        `/api/v1/cart/items/${itemId}`,
        {
          method: "DELETE",
        },
      );
      setCart(result.cart);
      router.refresh();
    } catch {
      // Silently handle
    } finally {
      setLoadingId(null);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const result = await apiFetch<{
        code: string;
        couponId: string;
        discountYen: number;
      }>("/api/v1/coupons/validate", {
        method: "POST",
        body: JSON.stringify({
          code: couponCode.trim(),
          orderTotalYen: cart.totalYen,
        }),
      });
      setAppliedCoupon(result);
    } catch (err) {
      setCouponError(
        err instanceof Error ? err.message : "クーポンの適用に失敗しました",
      );
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  }

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const FREE_SHIPPING_THRESHOLD = 8000;
  const shippingYen = cart.totalYen >= FREE_SHIPPING_THRESHOLD ? 0 : 600;
  const remainingForFreeShipping = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD - cart.totalYen,
  );
  const freeShippingProgress = Math.min(
    100,
    (cart.totalYen / FREE_SHIPPING_THRESHOLD) * 100,
  );
  const finalTotal =
    cart.totalYen - (appliedCoupon?.discountYen ?? 0) + shippingYen;

  if (cart.items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
          shopping_cart
        </span>
        <p className="text-sm text-gray-400 mb-4">カートが空です</p>
        <Link
          href="/shop"
          className="inline-block px-6 py-2.5 text-sm bg-black text-white hover:bg-gray-800 transition rounded"
        >
          ショップへ戻る
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-black">
          カート{" "}
          <span className="text-sm font-normal text-gray-400">
            ({totalItems}点)
          </span>
        </h1>
      </div>

      <div className="flex gap-6">
        {/* Left: Cart Items */}
        <div className="flex-1">
          {/* Free shipping progress */}
          <div className="card p-3 mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500">
                {remainingForFreeShipping > 0 ? (
                  <>
                    あと{" "}
                    <span className="font-bold text-black">
                      ¥{remainingForFreeShipping.toLocaleString()}
                    </span>{" "}
                    で送料無料！
                  </>
                ) : (
                  <span className="font-bold text-emerald-600">
                    送料無料です！
                  </span>
                )}
              </span>
              <span className="text-[10px] text-gray-400">
                ¥{cart.totalYen.toLocaleString()} / ¥
                {FREE_SHIPPING_THRESHOLD.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>

          {/* Cart items */}
          {cart.items.map((item) => {
            const isLoading = loadingId === item.id;
            return (
              <div
                key={item.id}
                className={`card p-4 mb-2 transition ${isLoading ? "opacity-50" : ""}`}
              >
                <div className="flex gap-4">
                  {/* Product image or placeholder */}
                  <div className="w-16 h-16 rounded flex items-center justify-center shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-full"
                        style={{
                          background:
                            "conic-gradient(#f472b6 0% 25%, #c084fc 25% 40%, #60a5fa 40% 55%, #34d399 55% 70%, #fbbf24 70% 85%, #f0f0f0 85% 100%)",
                        }}
                      >
                        <div className="w-7 h-7 rounded-full bg-white mt-3.5 ml-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-black">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          ¥{item.priceYen.toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={isLoading}
                        className="text-gray-300 hover:text-red-500 disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          close
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-gray-200 rounded">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          disabled={isLoading}
                          className="w-7 h-7 text-gray-500 hover:bg-gray-50 text-xs disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="w-7 h-7 flex items-center justify-center text-xs font-medium border-x border-gray-200">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          disabled={isLoading}
                          className="w-7 h-7 text-gray-500 hover:bg-gray-50 text-xs disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          ¥{(item.priceYen * item.quantity).toLocaleString()}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-[9px] text-gray-400">
                            ¥{item.priceYen.toLocaleString()} x {item.quantity}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Coupon Code */}
          <div className="card p-4 mt-4">
            <p className="text-[10px] font-medium text-gray-500 mb-2">
              クーポンコード
            </p>
            {appliedCoupon ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-black">
                    {appliedCoupon.code}
                  </span>
                  <span className="text-sm text-emerald-600">
                    -¥{appliedCoupon.discountYen.toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-sm text-gray-400 hover:text-black transition"
                >
                  取消
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="クーポンコードを入力"
                    className="flex-1 border border-gray-200 px-3 py-2 text-xs focus:border-black focus:outline-none rounded"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-4 py-2 text-xs border border-gray-200 hover:border-black transition rounded disabled:opacity-40"
                  >
                    {couponLoading ? "..." : "適用"}
                  </button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-500 mt-2">{couponError}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="w-[260px] shrink-0 hidden md:block">
          <div className="card p-5 sticky top-4">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
              注文概要
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">小計 ({totalItems}点)</span>
                <span>¥{cart.totalYen.toLocaleString()}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between">
                  <span className="text-gray-500">クーポン割引</span>
                  <span className="text-red-500">
                    -¥{appliedCoupon.discountYen.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">送料</span>
                <span>
                  {shippingYen === 0
                    ? "無料"
                    : `¥${shippingYen.toLocaleString()}`}
                </span>
              </div>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-3 mt-3">
              <span>合計（税込）</span>
              <span className="text-base">¥{finalTotal.toLocaleString()}</span>
            </div>

            <Link
              href="/checkout"
              className="btn-primary w-full py-3 text-sm font-medium mt-4 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-amber-300">
                lock
              </span>
              レジに進む
            </Link>

            {/* Payment Icons */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-[9px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">
                VISA
              </span>
              <span className="text-[9px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">
                Master
              </span>
              <span className="text-[9px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">
                JCB
              </span>
              <span className="text-[9px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">
                PayPay
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="material-symbols-outlined text-[14px]">
                  local_shipping
                </span>
                3-5営業日でお届け
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="material-symbols-outlined text-[14px]">
                  replay
                </span>
                未開封品は7日以内返品可
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="material-symbols-outlined text-[14px]">
                  verified_user
                </span>
                安全なSSL暗号化通信
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile summary (visible on small screens) */}
      <div className="md:hidden mt-6">
        <div className="card p-5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
            注文概要
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">小計 ({totalItems}点)</span>
              <span>¥{cart.totalYen.toLocaleString()}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between">
                <span className="text-gray-500">クーポン割引</span>
                <span className="text-red-500">
                  -¥{appliedCoupon.discountYen.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">送料</span>
              <span>
                {shippingYen === 0
                  ? "無料"
                  : `¥${shippingYen.toLocaleString()}`}
              </span>
            </div>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-3 mt-3">
            <span>合計（税込）</span>
            <span className="text-base">¥{finalTotal.toLocaleString()}</span>
          </div>
          <Link
            href="/checkout"
            className="btn-primary w-full py-3 text-sm font-medium mt-4 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base text-amber-300">
              lock
            </span>
            レジに進む
          </Link>
          <Link
            href="/shop"
            className="block mt-3 w-full border border-gray-200 py-3 text-sm text-center text-gray-600 hover:border-black transition rounded"
          >
            買い物を続ける
          </Link>
        </div>
      </div>
    </div>
  );
}
