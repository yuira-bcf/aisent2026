"use client";

import { useEffect } from "react";

export function VisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    fetch(`/api/v1/creators/${slug}/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {
      // silently ignore visit tracking errors
    });
  }, [slug]);

  return null;
}
