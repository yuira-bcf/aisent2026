import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

const menuSections = [
  {
    title: "調合",
    items: [
      { href: "/blend", icon: "local_florist", label: "調合リクエスト" },
      { href: "/history", icon: "history", label: "調合履歴" },
    ],
  },
  {
    title: "ショップ",
    items: [
      { href: "/shop", icon: "storefront", label: "商品一覧" },
      { href: "/cart", icon: "shopping_cart", label: "カート" },
      { href: "/orders", icon: "receipt_long", label: "注文履歴" },
      { href: "/favorites", icon: "favorite", label: "お気に入り" },
      { href: "/addresses", icon: "local_shipping", label: "配送先管理" },
    ],
  },
  {
    title: "クリエイター",
    items: [
      { href: "/creators", icon: "palette", label: "クリエイター一覧" },
      {
        href: "/creator-application",
        icon: "how_to_reg",
        label: "クリエイター申請",
      },
    ],
  },
  {
    title: "設定",
    items: [
      { href: "/profile", icon: "person", label: "プロフィール" },
      { href: "/notifications", icon: "notifications", label: "通知" },
      { href: "/notification-settings", icon: "tune", label: "通知設定" },
      { href: "/help", icon: "help", label: "ヘルプ" },
      { href: "/about", icon: "info", label: "アプリについて" },
    ],
  },
];

export default async function MyPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user;
  const initials = (user.name ?? user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 bg-gray-200 flex items-center justify-center text-lg font-medium text-gray-600 shrink-0"
          style={{ borderRadius: "50%" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-black truncate">
            {user.name ?? "ユーザー"}
          </h1>
          <p className="text-sm text-gray-400 truncate">{user.email}</p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-black transition mt-1"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            編集
          </Link>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="space-y-6">
        {menuSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              {section.title}
            </h2>
            <div className="border border-gray-200 divide-y divide-gray-100">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                >
                  <span className="material-symbols-outlined text-lg text-gray-500">
                    {item.icon}
                  </span>
                  <span className="flex-1 text-sm text-black">
                    {item.label}
                  </span>
                  <span className="material-symbols-outlined text-base text-gray-400">
                    chevron_right
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="mt-8">
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="w-full px-4 py-3 text-sm text-red-600 border border-gray-200 hover:border-red-300 transition flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            ログアウト
          </button>
        </form>
      </div>
    </div>
  );
}
