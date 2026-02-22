"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp, Megaphone, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Announcement } from "@/lib/supabase/queries";

type Props = {
  announcements: Announcement[];
};

function AnnouncementHistory() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/announcements?all=true")
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return <p className="text-xs text-gray-400 text-center py-8">読み込み中…</p>;
  }
  if (!items || items.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">お知らせはまだありません</p>;
  }

  return (
    <div className="overflow-y-auto max-h-[55vh] space-y-3 pr-1 -mr-1">
      {items.map((a) => {
        const expired = a.display_until < today;
        return (
          <div
            key={a.id}
            className={`rounded-xl p-3 border ${expired ? "bg-gray-50 border-gray-100" : "bg-orange-50 border-orange-100"}`}
          >
            <p className={`text-sm leading-relaxed break-words ${expired ? "text-gray-500" : "text-gray-700"}`}>
              {a.content}
            </p>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {a.display_until.slice(5).replace("-", "/")} まで
              {expired && <span className="ml-1">（終了）</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function AnnouncementBanner({ announcements }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasActive = !dismissed && announcements.length > 0;
  const hasMore = announcements.length > 1;

  return (
    <>
      {hasActive && (
        <div className="mx-4 mb-1 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 shadow-sm overflow-hidden">
          <div className="flex items-start gap-2 px-3 py-2.5">
            <Megaphone size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-orange-600 mb-0.5 leading-none">新機能のお知らせ</p>
              <p className="text-xs text-gray-700 leading-relaxed">{announcements[0].content}</p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="閉じる"
            >
              <X size={14} />
            </button>
          </div>

          {expanded && announcements.slice(1).map((a) => (
            <div key={a.id} className="flex items-start gap-2 px-3 py-2 border-t border-orange-100">
              <span className="w-[14px] flex-shrink-0" />
              <p className="text-xs text-gray-700 leading-relaxed flex-1">{a.content}</p>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1 py-1.5 border-t border-orange-100 text-[11px] text-orange-500 font-medium hover:bg-orange-50 transition-colors"
            >
              {expanded ? (
                <><ChevronUp size={12} />折りたたむ</>
              ) : (
                <><ChevronDown size={12} />他{announcements.length - 1}件を見る</>
              )}
            </button>
          )}
        </div>
      )}

      {/* 過去のお知らせリンク（常時表示） */}
      <div className="flex justify-end px-4 mb-3">
        <Dialog>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-orange-500 transition-colors">
              <Clock size={11} />
              過去のお知らせ
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Megaphone size={15} className="text-orange-500" />
                お知らせ履歴
              </DialogTitle>
            </DialogHeader>
            <AnnouncementHistory />
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
