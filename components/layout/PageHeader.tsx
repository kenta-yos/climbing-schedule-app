"use client";

import Image from "next/image";
import { useUserStore } from "@/lib/store/useUserStore";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: string;
  heroImage?: string;
};

export function PageHeader({ title, subtitle, icon, heroImage }: PageHeaderProps) {
  const { userName, userColor, userIcon } = useUserStore();

  const hasHero = !!heroImage;

  return (
    <header
      className={`sticky top-0 z-40 ${hasHero ? "relative overflow-hidden" : "bg-white/90 backdrop-blur-md border-b border-gray-100"}`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {hasHero && (
        <>
          <Image src={heroImage} alt="" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-black/40" />
        </>
      )}
      <div className={`flex items-center justify-between px-4 py-3 max-w-lg mx-auto ${hasHero ? "relative z-10" : ""}`}>
        <div className="flex items-center gap-2">
          {icon && (
            <Image src={icon} alt="icon" width={28} height={28} className="rounded-lg flex-shrink-0" />
          )}
          <div>
            <h1 className={`text-lg font-bold ${hasHero ? "text-white" : "text-gray-900"}`}>{title}</h1>
            {subtitle && (
              <p className={`text-xs mt-0.5 ${hasHero ? "text-white/80" : "text-gray-500"}`}>{subtitle}</p>
            )}
          </div>
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
