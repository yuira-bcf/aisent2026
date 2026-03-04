import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
      <p className="mb-2 text-7xl font-bold text-gray-200">404</p>
      <h1 className="mb-2 text-xl font-semibold">ページが見つかりません</h1>
      <p className="mb-6 text-sm text-gray-500">
        お探しの管理ページは存在しないか、移動した可能性があります。
      </p>
      <Link href="/admin" className="btn-primary px-5 py-2 text-sm">
        管理ダッシュボードへ
      </Link>
    </div>
  );
}
