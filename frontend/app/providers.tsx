"use client";

import { useEffect } from "react";

const STORAGE_KEY = "illuvrse_theme";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const isCream = stored === "cream";
    document.documentElement.classList.toggle("theme-cream", isCream);
  }, []);

  return <>{children}</>;
}
