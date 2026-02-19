"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/toaster";
import { usePathname } from "next/navigation";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFullscreen = pathname === "/home/plan";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* BottomNav分(4rem) + safe area bottom を下部余白として確保 */}
      <main
        className="max-w-lg mx-auto"
        style={isFullscreen
          ? {}
          : { paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }
        }
      >
        {children}
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
