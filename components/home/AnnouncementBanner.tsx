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
import { getTodayJST } from "@/lib/utils";
import type { Announcement } from "@/lib/supabase/queries";

type Props = {
  announcements: Announcement[];
};

// 閉じたお知らせのIDを端末ごとに覚えておく
const DISMISSED_KEY = "dismissedAnnouncements";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function AnnouncementHistory() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/announcements?all=true")
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const today = getTodayJST();

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

/** 過去のお知らせを開くリンク。バナーの有無にかかわらず常に出す */
function HistoryTrigger() {
  return (
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
  );
}

export function AnnouncementBanner({ announcements }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  // localStorage を読むまではバナーを出さない。
  // 閉じたはずのお知らせが一瞬見えてしまうのを防ぐため。
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
    setReady(true);
  }, []);

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  const showBanner = ready && visible.length > 0;
  const hasMore = visible.length > 1;

  const handleDismiss = () => {
    const next = Array.from(new Set([...dismissed, ...visible.map((a) => a.id)]));
    setDismissed(next);
    setExpanded(false);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // 保存できなくても表示上は閉じる
    }
  };

  // バナーが無いときは履歴リンクだけを残す
  if (!showBanner) {
    return (
      <div className="flex justify-end">
        <HistoryTrigger />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-100 border-l-4 border-l-orange-400 shadow-sm overflow-hidden">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <Megaphone size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-orange-600 mb-0.5 leading-none">新機能のお知らせ</p>
          <p className="text-xs text-gray-700 leading-relaxed">{visible[0].content}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="閉じる"
        >
          <X size={14} />
        </button>
      </div>

      {expanded &&
        visible.slice(1).map((a) => (
          <div key={a.id} className="flex items-start gap-2 px-3 py-2 border-t border-gray-50">
            <span className="w-[14px] flex-shrink-0" />
            <p className="text-xs text-gray-700 leading-relaxed flex-1">{a.content}</p>
          </div>
        ))}

      {/* 下端に「他N件」と履歴リンクをまとめる */}
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-t border-gray-50">
        {hasMore ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-orange-500 font-medium hover:text-orange-600 transition-colors"
          >
            {expanded ? (
              <><ChevronUp size={12} />折りたたむ</>
            ) : (
              <><ChevronDown size={12} />他{visible.length - 1}件を見る</>
            )}
          </button>
        ) : (
          <span />
        )}
        <HistoryTrigger />
      </div>
    </div>
  );
}
