"use client";

type Props = {
  sessions: number;
  gyms: number;
  period: string;
};

export function StatsCard({ sessions, gyms, period }: Props) {
  return (
    <div className="climbing-gradient rounded-2xl p-4 text-white shadow-lg">
      <p className="text-xs text-white/70 mb-3 font-medium text-center">{period}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/15 rounded-xl py-3 flex flex-col items-center justify-center gap-0.5">
          <div className="text-3xl font-bold">{sessions}</div>
          <div className="text-xs text-white/80 font-medium">セッション</div>
        </div>
        <div className="bg-white/15 rounded-xl py-3 flex flex-col items-center justify-center gap-0.5">
          <div className="text-3xl font-bold">{gyms}</div>
          <div className="text-xs text-white/80 font-medium">ジム数</div>
        </div>
      </div>
    </div>
  );
}
