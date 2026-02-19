"use client";

import { useUserStore } from "@/lib/store/useUserStore";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  const { userName, userColor, userIcon } = useUserStore();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {userName && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium shadow-sm"
            style={{ backgroundColor: userColor || "#FF512F" }}
          >
            <span className="text-base leading-none">{userIcon}</span>
            <span className="text-xs">{userName}</span>
          </div>
        )}
      </div>
    </header>
  );
}
