import { auth } from "@/lib/auth";
import { getCart } from "@/lib/services/cart-service";
import { redirect } from "next/navigation";
import CartView from "./cart-view";

export default async function CartPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const cart = await getCart(session.user.id);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          カート
        </h1>
        <p className="text-sm text-gray-400">{cart.items.length}件のアイテム</p>
      </div>

      <CartView initialCart={cart} />
    </div>
  );
}
