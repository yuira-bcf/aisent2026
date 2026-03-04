export default function CreatorLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
      <div className="mb-4 flex gap-1.5">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-gray-400 [animation-delay:0ms]" />
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-gray-400 [animation-delay:300ms]" />
      </div>
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  );
}
