"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ProfileTab } from "@/components/admin/tabs/ProfileTab";
import { GymTab } from "@/components/admin/tabs/GymTab";
import { NoticeTab } from "@/components/admin/tabs/NoticeTab";
import { UsersTab } from "@/components/admin/tabs/UsersTab";
import { useUserStore } from "@/lib/store/useUserStore";
import { LogOut, Loader2 } from "lucide-react";
import type { GymMaster, AreaMaster, Announcement, User } from "@/lib/supabase/queries";

type Tab = "profile" | "gym" | "notice" | "users";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  currentUser: string;
  isAdmin?: boolean;
  announcements?: Announcement[];
  users?: User[];
};

export function AdminClient({
  gyms,
  areas,
  currentUser,
  isAdmin,
  announcements: initialAnnouncements = [],
  users: initialUsers = [],
}: Props) {
  const router = useRouter();
  const clearUser = useUserStore((s) => s.clearUser);

  // タブ管理（お知らせ・ユーザーは管理者のみ）
  const [tab, setTab] = useState<Tab>("profile");
  const [navigatingAnalytics, setNavigatingAnalytics] = useState(false);

  const tabs: { key: Tab; label: string; adminOnly: boolean }[] = [
    { key: "profile", label: "🙋 マイ設定", adminOnly: false },
    { key: "gym", label: "🧗 ジム登録", adminOnly: false },
    { key: "notice", label: "📣 お知らせ", adminOnly: true },
    { key: "users", label: "👤 ユーザー", adminOnly: true },
  ];
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  const handleLogout = () => {
    clearUser();
    document.cookie = "user_name=; path=/; max-age=0";
    document.cookie = "user_color=; path=/; max-age=0";
    document.cookie = "user_icon=; path=/; max-age=0";
    router.push("/");
  };

  return (
    <>
      <PageHeader title="管理" />
      <div className="px-4 py-4 space-y-4 page-enter">

        {/* 分析ダッシュボードリンク（管理者のみ） */}
        {isAdmin && (
          <a
            href="/admin/analytics"
            onClick={() => setNavigatingAnalytics(true)}
            className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-800">📊 分析ダッシュボード</span>
            {navigatingAnalytics ? (
              <Loader2 size={16} className="text-gray-400 animate-spin" />
            ) : (
              <span className="text-gray-400 text-xs">→</span>
            )}
          </a>
        )}

        {/* タブ切り替え */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {visibleTabs.map(({ key, label }, i) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                i > 0 ? "border-l border-gray-200" : ""
              } ${tab === key ? "climbing-gradient text-white" : "text-gray-500"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <ProfileTab currentUser={currentUser} users={initialUsers} />
        )}

        {tab === "gym" && (
          <GymTab gyms={gyms} areas={areas} currentUser={currentUser} />
        )}

        {tab === "notice" && isAdmin && (
          <NoticeTab
            initialAnnouncements={initialAnnouncements}
            currentUser={currentUser}
          />
        )}

        {tab === "users" && isAdmin && (
          <UsersTab initialUsers={initialUsers} currentUser={currentUser} />
        )}

        {/* ログアウト */}
        <div className="pt-2">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center gap-2 text-gray-500 border-gray-200"
          >
            <LogOut size={16} />
            ログアウト
          </Button>
        </div>
      </div>
    </>
  );
}
