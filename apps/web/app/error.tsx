"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <span className="material-symbols-outlined mb-4 text-5xl text-gray-400">
        error
      </span>
      <h1 className="mb-2 text-xl font-semibold">エラーが発生しました</h1>
      <p className="mb-6 max-w-md text-center text-sm text-gray-500">
        {error.message || "予期しないエラーが発生しました。"}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-primary px-5 py-2 text-sm"
        >
          再読み込み
        </button>
        <a href="/" className="btn-secondary px-5 py-2 text-sm">
          ホームに戻る
        </a>
      </div>
    </div>
  );
}
