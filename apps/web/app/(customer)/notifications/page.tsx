import { auth } from "@/lib/auth";
import { getNotificationsForUser } from "@/lib/services/notification-service";
import { redirect } from "next/navigation";
import { NotificationList } from "./notification-list";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { items, total, unreadCount } = await getNotificationsForUser(
    session.user.id,
    1,
    50,
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          通知
        </h1>
        <p className="text-sm text-gray-400">
          未読 {unreadCount} 件 / 全 {total} 件
        </p>
      </div>
      <NotificationList
        initialItems={items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
