"use client";

import { useState } from "react";

type Image = {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
};

export default function ImageGallery({
  images,
  productName,
}: {
  images: Image[];
  productName: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gray-50 flex items-center justify-center">
        <span
          className="material-symbols-outlined text-gray-300"
          style={{ fontSize: 200 }}
        >
          spa
        </span>
      </div>
    );
  }

  const mainImage = images[selectedIndex];

  return (
    <div>
      {/* Main image */}
      <div className="aspect-square bg-gray-50 overflow-hidden">
        <img
          src={mainImage.url}
          alt={mainImage.alt ?? productName}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Thumbnail row */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`w-16 h-16 overflow-hidden border-2 transition ${
                idx === selectedIndex
                  ? "border-black"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              <img
                src={img.url}
                alt={img.alt ?? `${productName} ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
