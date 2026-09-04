"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/hooks/use-toast";
import { useUserStore } from "@/lib/store/useUserStore";
import { Loader2 } from "lucide-react";
import type { User } from "@/lib/supabase/queries";

type Props = {
  /** ログイン中のユーザー名 */
  currentUser: string;
  /** 全ユーザー。自分の現在値の取得に使う */
  users: User[];
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function ProfileTab({ currentUser, users }: Props) {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);

  const me = users.find((u) => u.user_name === currentUser);

  const [name, setName] = useState(currentUser);
  const [icon, setIcon] = useState(me?.icon ?? "🧗");
  const [color, setColor] = useState(me?.color ?? "#f97316");
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const trimmedIcon = icon.trim();
  const isRename = trimmedName !== currentUser;
  const isDirty =
    isRename || trimmedIcon !== (me?.icon ?? "") || color !== (me?.color ?? "");

  const handleSave = async () => {
    if (!trimmedName) {
      toast({ title: "名前を入力してください", variant: "destructive" });
      return;
    }
    if (!trimmedIcon) {
      toast({ title: "アイコンを入力してください", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: currentUser,
          new_user_name: trimmedName,
          color,
          icon: trimmedIcon,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          title: body?.error ?? "更新に失敗しました",
          variant: "destructive",
        });
        // 名前だけ変わって履歴の追従に失敗した場合も、ログイン情報は合わせておく
        if (body?.partial && body?.user_name) {
          setUser(body.user_name, color, trimmedIcon);
          setCookie("user_name", body.user_name);
          setCookie("user_color", color);
          setCookie("user_icon", trimmedIcon);
          router.refresh();
        }
        return;
      }

      const savedName: string = body?.user_name ?? trimmedName;

      // ログイン情報を更新する。Cookie はサーバー側の本人判定に使われるため必須。
      setUser(savedName, color, trimmedIcon);
      setCookie("user_name", savedName);
      setCookie("user_color", color);
      setCookie("user_icon", trimmedIcon);

      toast({ title: "プロフィールを更新しました", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "更新に失敗しました", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
      <h3 className="text-sm font-bold text-gray-800">プロフィール設定</h3>

      {/* プレビュー */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-2xl text-white flex-shrink-0 shadow-sm"
          style={{ backgroundColor: color }}
        >
          {trimmedIcon || "🧗"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {trimmedName || "（名前なし）"}
          </p>
          <p className="text-[11px] text-gray-400">アプリ全体でこの見た目になります</p>
        </div>
      </div>

      {/* 名前 */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">
          名前
          <span className="ml-1 text-red-400 font-semibold">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名前を入力"
          maxLength={20}
        />
        {isRename && (
          <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
            名前を変えると、過去の予定・実績もすべて新しい名前に付け替えます。
          </p>
        )}
      </div>

      {/* アイコンと色 */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">
            アイコン
            <span className="ml-1 text-red-400 font-semibold">*</span>
          </label>
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="絵文字"
            className="text-center text-lg"
            maxLength={4}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">色</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-14 h-10 rounded-lg border border-gray-200 bg-white cursor-pointer"
          />
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || !isDirty}
        variant="climbing"
        className="w-full"
      >
        {saving ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" />
            保存中…
          </>
        ) : (
          "保存する"
        )}
      </Button>
    </div>
  );
}
