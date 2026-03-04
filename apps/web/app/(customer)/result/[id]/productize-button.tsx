"use client";

import { type ProductizeState, productizeBlend } from "@/actions/blend";
import { useActionState, useState } from "react";

export default function ProductizeButton({
  blendResultId,
  defaultName,
  defaultDescription,
}: {
  blendResultId: string;
  defaultName: string;
  defaultDescription: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const initialState: ProductizeState = {};
  const [state, formAction, pending] = useActionState(
    productizeBlend,
    initialState,
  );

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-primary px-3 py-1.5 text-[10px]"
      >
        商品化する
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white border border-gray-200 shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-black">商品化</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-black text-xs"
        >
          閉じる
        </button>
      </div>
      <form action={formAction}>
        <input type="hidden" name="blendResultId" value={blendResultId} />
        <div className="mb-3">
          <label
            htmlFor="productize-name"
            className="block text-[10px] text-gray-500 mb-1"
          >
            商品名
          </label>
          <input
            id="productize-name"
            name="name"
            type="text"
            defaultValue={defaultName}
            className="w-full border border-gray-200 px-2 py-1.5 text-[11px] focus:border-black focus:outline-none"
          />
        </div>
        <div className="mb-3">
          <label
            htmlFor="productize-description"
            className="block text-[10px] text-gray-500 mb-1"
          >
            説明
          </label>
          <textarea
            id="productize-description"
            name="description"
            rows={3}
            defaultValue={defaultDescription}
            className="w-full border border-gray-200 px-2 py-1.5 text-[11px] focus:border-black focus:outline-none resize-none"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400">30ml / 4,980円</p>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary px-4 py-1.5 text-[10px] disabled:opacity-50"
          >
            {pending ? "処理中..." : "商品化する"}
          </button>
        </div>
        {state.error && (
          <div className="mt-2 text-[10px] text-red-600 bg-red-50 border border-red-200 px-3 py-2">
            {state.error}
          </div>
        )}
      </form>
    </div>
  );
}
