import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCart } from "@/lib/services/cart-service";
import { shippingAddresses } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import CheckoutForm from "./checkout-form";

export default async function CheckoutPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const cart = await getCart(session.user.id);

  // Redirect to shop if cart is empty
  if (cart.items.length === 0) redirect("/shop");

  const addresses = await db
    .select()
    .from(shippingAddresses)
    .where(eq(shippingAddresses.userId, session.user.id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          注文確認
        </h1>
        <p className="text-sm text-gray-400">
          内容を確認して注文を確定してください
        </p>
      </div>

      {/* Order summary */}
      <div className="border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-gray-400">
            shopping_bag
          </span>
          注文内容
        </h2>
        <div className="space-y-3">
          {cart.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-gray-50 flex-shrink-0 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-sm text-gray-300">
                      spa
                    </span>
                  )}
                </div>
                <span className="text-black truncate">{item.name}</span>
                <span className="text-gray-400 flex-shrink-0">
                  x{item.quantity}
                </span>
              </div>
              <span className="font-medium text-black flex-shrink-0 ml-4">
                ¥{(item.priceYen * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">合計</span>
          <span className="text-xl font-bold text-black">
            ¥{cart.totalYen.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Shipping address selection + submit */}
      <CheckoutForm addresses={addresses} />
    </div>
  );
}
