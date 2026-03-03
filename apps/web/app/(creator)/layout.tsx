import NotificationBadge from "@/components/notification-badge";
import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <nav className="bg-black">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-bold tracking-tight text-white"
            >
              KyaraInnovate
            </Link>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <Link href="/keywords" className="hover:text-white transition">
                キーワード
              </Link>
              <Link href="/stats" className="hover:text-white transition">
                統計
              </Link>
              <Link
                href="/creator/dashboard"
                className="hover:text-white transition"
              >
                ダッシュボード
              </Link>
              <Link
                href="/creator/settings"
                className="hover:text-white transition"
              >
                設定
              </Link>
              <Link
                href="/creator/recipes"
                className="hover:text-white transition"
              >
                レシピ
              </Link>
              <Link
                href="/creator/royalties"
                className="hover:text-white transition"
              >
                ロイヤリティ
              </Link>
              <Link
                href="/creator/data-input"
                className="hover:text-white transition"
              >
                データ入力
              </Link>
              <Link
                href="/creator/footprints"
                className="hover:text-white transition"
              >
                あしあと
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <NotificationBadge />
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Creator
            </span>
            <span>{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="hover:text-white transition">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
