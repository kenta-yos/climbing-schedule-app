"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/hooks/use-toast";
import { getDateOffsetJST } from "@/lib/utils";
import { Trash2, Megaphone } from "lucide-react";
import type { Announcement } from "@/lib/supabase/queries";

type Props = {
  initialAnnouncements: Announcement[];
  currentUser: string;
};

export function NoticeTab({ initialAnnouncements, currentUser }: Props) {
  // ---- お知らせ登録 ----
  const [noticeContent, setNoticeContent] = useState("");
  // デフォルト：3日後
  const [noticeUntil, setNoticeUntil] = useState(() => getDateOffsetJST(3));
  const [submittingNotice, setSubmittingNotice] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  // ---- お知らせ登録処理 ----
  const handleAddNotice = async () => {
    if (!noticeContent.trim()) {
      toast({ title: "お知らせ内容を入力してください", variant: "destructive" });
      return;
    }
    if (!noticeUntil) {
      toast({ title: "表示終了日を設定してください", variant: "destructive" });
      return;
    }
    setSubmittingNotice(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noticeContent.trim(), display_until: noticeUntil, created_by: currentUser }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "お知らせを登録しました！", variant: "success" });
      setNoticeContent("");
      // 一覧を再取得
      const updated = await fetch("/api/announcements").then((r) => r.json());
      setAnnouncements(updated);
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingNotice(false);
    }
  };

  // ---- お知らせ削除処理 ----
  const handleDeleteNotice = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "削除しました" });
    } catch {
      toast({ title: "削除に失敗しました", variant: "destructive" });
    }
  };

  return (
    <>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Megaphone size={16} className="text-orange-500" />
            新機能お知らせ登録
          </h3>

          {/* お知らせ内容 */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">内容</label>
            <textarea
              value={noticeContent}
              onChange={(e) => setNoticeContent(e.target.value)}
              placeholder="例：つながりページが公開されました！誰と一緒に登っているかを可視化できます。"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
            />
          </div>

          {/* 表示終了日 */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">表示終了日</label>
            <Input
              type="date"
              value={noticeUntil}
              onChange={(e) => setNoticeUntil(e.target.value)}
              className="text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">この日まで（当日含む）トップページに表示されます</p>
          </div>

          <Button
            onClick={handleAddNotice}
            disabled={submittingNotice}
            variant="climbing"
            className="w-full"
          >
            {submittingNotice ? "登録中..." : "お知らせを登録"}
          </Button>
        </div>

        {/* 登録済みお知らせ一覧 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">📋 登録済みお知らせ</p>
          </div>
          {announcements.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">登録済みのお知らせはありません</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {announcements.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{a.content}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{a.display_until.slice(5).replace("-", "/")} まで表示</p>
                  </div>
                  <button
                    onClick={() => handleDeleteNotice(a.id)}
                    className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
    </>
  );
}
