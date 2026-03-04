"use client";

import { useEffect } from "react";

export function SplashHider() {
  useEffect(() => {
    const s = document.getElementById("splash");
    if (!s) return;
    const t = setTimeout(() => {
      s.style.opacity = "0";
      setTimeout(() => s.remove(), 400);
    }, 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}
