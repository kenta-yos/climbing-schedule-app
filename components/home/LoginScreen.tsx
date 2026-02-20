"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUserStore } from "@/lib/store/useUserStore";
import { addAccessLog } from "@/lib/supabase/queries";
import type { User } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";

type Props = {
  users: User[];
};

export function LoginScreen({ users }: Props) {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const [loading, setLoading] = useState<string | null>(null);

  const handleLogin = async (user: User) => {
    if (loading) return;
    setLoading(user.user_name);
    try {
      // アクセスログを記録
      await addAccessLog(user.user_name);

      // Zustandストアに保存
      setUser(user.user_name, user.color, user.icon);

      // Cookieに保存（middleware用）
      document.cookie = `user_name=${encodeURIComponent(user.user_name)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      document.cookie = `user_color=${encodeURIComponent(user.color)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      document.cookie = `user_icon=${encodeURIComponent(user.icon)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;

      router.push("/home");
    } catch (err) {
      console.error(err);
      toast({ title: "エラー", description: "ログインに失敗しました", variant: "destructive" });
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-orange-50 via-white to-pink-50">
      {/* ロゴ */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl shadow-lg mb-4 overflow-hidden">
          <Image src="/icon-192.png" alt="Go Bouldering" width={80} height={80} className="object-cover" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Go Bouldering</h1>
        <p className="text-sm text-gray-500 mt-1">ボルダリング管理アプリ</p>
      </div>

      {/* ユーザー選択 */}
      <div className="w-full max-w-sm">
        <p className="text-center text-sm text-gray-600 mb-4 font-medium">
          ユーザーを選択してください
        </p>
        <div className="grid grid-cols-3 gap-3">
          {users.map((user) => {
            const isLoading = loading === user.user_name;
            return (
              <button
                key={user.user_name}
                onClick={() => handleLogin(user)}
                disabled={!!loading}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border-2 border-transparent shadow-sm transition-all duration-200 active:scale-95 hover:shadow-md disabled:opacity-60"
                style={{
                  borderColor: isLoading ? user.color : "transparent",
                  boxShadow: isLoading ? `0 0 0 3px ${user.color}40` : undefined,
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl text-white shadow-md"
                  style={{ backgroundColor: user.color }}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>{user.icon}</span>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-700 text-center leading-tight">
                  {user.user_name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400">
        タップしてログイン
      </p>
    </div>
  );
}
