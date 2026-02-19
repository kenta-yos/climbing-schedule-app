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
      <main className={`max-w-lg mx-auto ${isFullscreen ? "" : "pb-20"}`}>
        {children}
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
