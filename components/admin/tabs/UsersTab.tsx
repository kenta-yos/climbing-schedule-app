"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/hooks/use-toast";
import { useUserStore } from "@/lib/store/useUserStore";
import { Trash2, Pencil } from "lucide-react";
import type { User } from "@/lib/supabase/queries";

type Props = {
  initialUsers: User[];
  /** ログイン中のユーザー名。自分を改名したときにログイン情報を更新するため */
  currentUser: string;
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function UsersTab({ initialUsers, currentUser }: Props) {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  // ---- ユーザー管理 ----
  const [userList, setUserList] = useState<User[]>(initialUsers);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserColor, setNewUserColor] = useState("#f97316");
  const [newUserIcon, setNewUserIcon] = useState("");
  const [submittingUser, setSubmittingUser] = useState(false);
  // ---- ユーザー編集処理 ----
  const handleStartEdit = (user: User) => {
    setEditingUser(user.user_name);
    setEditName(user.user_name);
    setEditColor(user.color);
    setEditIcon(user.icon);
  };

  const handleSaveUser = async (userName: string) => {
    const trimmedName = editName.trim();
    const trimmedIcon = editIcon.trim();
    if (!trimmedName) {
      toast({ title: "名前を入力してください", variant: "destructive" });
      return;
    }
    if (!trimmedIcon) {
      toast({ title: "アイコンを入力してください", variant: "destructive" });
      return;
    }

    setSubmittingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: userName,
          new_user_name: trimmedName,
          color: editColor,
          icon: trimmedIcon,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: body?.error ?? "更新に失敗しました", variant: "destructive" });
        return;
      }

      const savedName: string = body?.user_name ?? trimmedName;
      setUserList((prev) =>
        prev.map((u) =>
          u.user_name === userName
            ? { ...u, user_name: savedName, color: editColor, icon: trimmedIcon }
            : u
        )
      );
      setEditingUser(null);

      // 自分自身を編集した場合はログイン情報も更新する
      if (userName === currentUser) {
        setUser(savedName, editColor, trimmedIcon);
        setCookie("user_name", savedName);
        setCookie("user_color", editColor);
        setCookie("user_icon", trimmedIcon);
        router.refresh();
      }

      toast({ title: "ユーザーを更新しました", variant: "success" });
    } catch {
      toast({ title: "更新に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserIcon.trim()) {
      toast({ title: "名前とアイコンを入力してください", variant: "destructive" });
      return;
    }
    setSubmittingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: newUserName.trim(), color: newUserColor, icon: newUserIcon.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated = await fetch("/api/users").then((r) => r.json());
      setUserList(updated);
      setNewUserName("");
      setNewUserColor("#f97316");
      setNewUserIcon("");
      toast({ title: "ユーザーを追加しました", variant: "success" });
    } catch {
      toast({ title: "追加に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (userName: string) => {
    try {
      const res = await fetch(`/api/users?user_name=${encodeURIComponent(userName)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setUserList((prev) => prev.filter((u) => u.user_name !== userName));
      toast({ title: "ユーザーを削除しました" });
    } catch {
      toast({ title: "削除に失敗しました", variant: "destructive" });
    }
  };

  return (
    <>
        {/* 新規登録 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-sm font-bold text-gray-800">新規ユーザー登録</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">名前</label>
              <Input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="名前を入力"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">アイコン</label>
              <Input
                value={newUserIcon}
                onChange={(e) => setNewUserIcon(e.target.value)}
                placeholder="絵文字"
                className="text-sm w-16 text-center"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">色</label>
              <input
                type="color"
                value={newUserColor}
                onChange={(e) => setNewUserColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
              />
            </div>
          </div>
          {/* プレビュー */}
          {(newUserName || newUserIcon) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-white"
                style={{ backgroundColor: newUserColor }}
              >
                {newUserIcon || "?"}
              </div>
              <span className="text-sm font-medium text-gray-700">{newUserName || "名前未入力"}</span>
            </div>
          )}
          <Button
            onClick={handleAddUser}
            disabled={submittingUser}
            variant="climbing"
            className="w-full"
          >
            {submittingUser ? "登録中..." : "ユーザーを追加"}
          </Button>
        </div>

        {/* ユーザー一覧 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">👤 登録ユーザー（{userList.length}人）</p>
          </div>
          <div className="divide-y divide-gray-50">
            {userList.map((user) => {
              const isEditing = editingUser === user.user_name;
              return (
                <div key={user.user_name} className="px-4 py-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-white flex-shrink-0"
                          style={{ backgroundColor: editColor }}
                        >
                          {editIcon || "?"}
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{user.user_name}</span>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">名前</label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm"
                          maxLength={20}
                        />
                        {editName.trim() !== user.user_name && (
                          <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
                            過去の予定・実績もすべて新しい名前に付け替えます。
                          </p>
                        )}
                      </div>
                      <div className="flex items-end gap-3">
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">アイコン</label>
                          <Input
                            value={editIcon}
                            onChange={(e) => setEditIcon(e.target.value)}
                            className="text-sm w-16 text-center"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">色</label>
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                          />
                        </div>
                        <div className="flex gap-2 ml-auto">
                          <button
                            onClick={() => setEditingUser(null)}
                            className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleSaveUser(user.user_name)}
                            disabled={submittingUser}
                            className="px-3 py-2 text-xs text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-60"
                          >
                            {submittingUser ? "保存中…" : "保存"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-white flex-shrink-0"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.icon}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 flex-1">{user.user_name}</span>
                      <button
                        onClick={() => handleStartEdit(user)}
                        className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.user_name)}
                        className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
    </>
  );
}
