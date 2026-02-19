"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, BarChart2, Building2, CalendarDays, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/home", label: "トップ", icon: Home },
  { href: "/dashboard", label: "ログ", icon: BarChart2 },
  { href: "/gyms", label: "ジム", icon: Building2 },
  { href: "/schedule", label: "セット", icon: CalendarDays },
  { href: "/admin", label: "管理", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // パスが変わったらローディング解除
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // フルスクリーンページではBottomNavを非表示
  if (pathname === "/home/plan") return null;

  const handleNav = (href: string) => {
    if (pathname === href || pendingHref === href) return;
    setPendingHref(href);
    router.push(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname !== null && (pathname === href || pathname.startsWith(href + "/"));
          const isPending = pendingHref === href;
          return (
            <button
              key={href}
              onClick={() => handleNav(href)}
              disabled={!!pendingHref}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200 active:scale-90 disabled:cursor-default",
                isActive || isPending
                  ? "text-orange-500"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all duration-200 relative",
                  (isActive || isPending) && "bg-orange-50"
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={(isActive || isPending) ? 2.5 : 1.8}
                  className={cn(
                    (isActive || isPending) && "text-orange-500",
                    isPending && "opacity-50"
                  )}
                />
                {/* ローディングリング */}
                {isPending && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  (isActive || isPending) ? "text-orange-500 font-semibold" : "text-gray-400"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
