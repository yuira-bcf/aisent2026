import MobileDrawer from "@/components/mobile-drawer";
import MobileNav from "@/components/mobile-nav";
import NotificationBadge from "@/components/notification-badge";
import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CustomerLayout({
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
            <div className="hidden md:flex items-center gap-4 text-sm text-gray-400">
              <Link href="/home" className="hover:text-white transition">
                ホーム
              </Link>
              <Link href="/blend" className="hover:text-white transition">
                調合
              </Link>
              <Link href="/history" className="hover:text-white transition">
                履歴
              </Link>
              <Link href="/shop" className="hover:text-white transition">
                ショップ
              </Link>
              <Link href="/creators" className="hover:text-white transition">
                クリエイター
              </Link>
              <Link href="/favorites" className="hover:text-white transition">
                お気に入り
              </Link>
              <Link href="/orders" className="hover:text-white transition">
                注文
              </Link>
              <Link
                href="/creator-application"
                className="hover:text-white transition"
              >
                クリエイター申請
              </Link>
              <Link href="/profile" className="hover:text-white transition">
                プロフィール
              </Link>
              <Link
                href="/notifications"
                className="hover:text-white transition"
              >
                通知
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <NotificationBadge />
            <span className="hidden md:inline">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="hidden md:inline hover:text-white transition"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </nav>
      <div className="pb-16 md:pb-0">{children}</div>
      <MobileNav />
      <MobileDrawer />
    </div>
  );
}
