"use client";

type Props = {
  sessions: number;
  gyms: number;
  period: string;
};

export function StatsCard({ sessions, gyms, period }: Props) {
  return (
    <div className="climbing-gradient rounded-2xl p-4 text-white shadow-lg">
      <p className="text-xs text-white/70 mb-3 font-medium">{period}</p>
      <div className="flex gap-6">
        <div>
          <div className="text-3xl font-bold">{sessions}</div>
          <div className="text-xs text-white/70 mt-0.5">セッション</div>
        </div>
        <div className="w-px bg-white/20" />
        <div>
          <div className="text-3xl font-bold">{gyms}</div>
          <div className="text-xs text-white/70 mt-0.5">ジム数</div>
        </div>
      </div>
    </div>
  );
}
