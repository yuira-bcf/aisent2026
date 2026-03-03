import { getAllOrders } from "@/lib/services/admin-service";
import { OrderManager } from "./orders-manager";

export default async function AdminOrdersPage() {
  const { items: orders } = await getAllOrders(1, 50);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          注文管理
        </h1>
        <p className="text-sm text-gray-400">{orders.length}件の注文</p>
      </div>
      <OrderManager initialOrders={orders} />
    </div>
  );
}
