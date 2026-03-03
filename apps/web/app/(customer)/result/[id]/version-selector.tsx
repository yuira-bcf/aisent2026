"use client";

import { useRouter } from "next/navigation";

export default function VersionSelector({
  currentId,
  versions,
}: {
  currentId: string;
  versions: { id: string; version: number }[];
}) {
  const router = useRouter();

  if (versions.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      {versions.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => {
            if (v.id !== currentId) {
              router.push(`/result/${v.id}`);
            }
          }}
          className={`px-2 py-1 text-[10px] rounded-full transition ${
            v.id === currentId
              ? "bg-black text-white font-medium"
              : "text-gray-400 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          v{v.version}
        </button>
      ))}
    </div>
  );
}
