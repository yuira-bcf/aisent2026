import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

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
              <Link
                href="/admin/dashboard"
                className="hover:text-white transition"
              >
                ダッシュボード
              </Link>
              <Link href="/admin/users" className="hover:text-white transition">
                ユーザー管理
              </Link>
              <Link
                href="/admin/orders"
                className="hover:text-white transition"
              >
                注文管理
              </Link>
              <Link
                href="/admin/creators"
                className="hover:text-white transition"
              >
                クリエイター管理
              </Link>
              <Link
                href="/admin/flavors"
                className="hover:text-white transition"
              >
                香料管理
              </Link>
              <Link
                href="/admin/products"
                className="hover:text-white transition"
              >
                商品
              </Link>
              <Link
                href="/admin/coupons"
                className="hover:text-white transition"
              >
                クーポン
              </Link>
              <Link
                href="/admin/reviews"
                className="hover:text-white transition"
              >
                レビュー
              </Link>
              <Link
                href="/admin/ec-settings"
                className="hover:text-white transition"
              >
                EC設定
              </Link>
              <Link
                href="/admin/ai-rules"
                className="hover:text-white transition"
              >
                AIルール
              </Link>
              <Link
                href="/admin/rule-matrix"
                className="hover:text-white transition"
              >
                マトリクス
              </Link>
              <Link
                href="/admin/calibration"
                className="hover:text-white transition"
              >
                キャリブレーション
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="text-xs uppercase tracking-wide text-amber-500">
              ADMIN
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
