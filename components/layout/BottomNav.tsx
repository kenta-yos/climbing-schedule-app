"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-bottom">
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200 active:scale-90",
                isActive
                  ? "text-orange-500"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all duration-200",
                  isActive && "bg-orange-50"
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={cn(isActive && "text-orange-500")}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  isActive ? "text-orange-500 font-semibold" : "text-gray-400"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
