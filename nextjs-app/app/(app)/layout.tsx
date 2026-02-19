"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/toaster";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-lg mx-auto pb-20">{children}</main>
      <BottomNav />
      <Toaster />
    </div>
  );
}
