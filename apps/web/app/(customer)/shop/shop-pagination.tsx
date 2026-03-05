"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function ShopPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(p));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Show at most 5 page buttons centered around current
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <button
        type="button"
        onClick={() => goToPage(page - 1)}
        disabled={page <= 1}
        className="px-2 py-1 text-[11px] border border-gray-200 rounded disabled:opacity-30 hover:border-black transition"
      >
        <span className="material-symbols-outlined text-[14px]">
          chevron_left
        </span>
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => goToPage(p)}
          className={`w-7 h-7 text-[11px] rounded transition ${
            p === page
              ? "bg-black text-white"
              : "border border-gray-200 text-gray-600 hover:border-black"
          }`}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        onClick={() => goToPage(page + 1)}
        disabled={page >= totalPages}
        className="px-2 py-1 text-[11px] border border-gray-200 rounded disabled:opacity-30 hover:border-black transition"
      >
        <span className="material-symbols-outlined text-[14px]">
          chevron_right
        </span>
      </button>
    </div>
  );
}
