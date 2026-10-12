export const metadata = {
  title: "Go Bouldering",
  robots: { index: false },
};

export default function ClosedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-sm">
        {/* 文の途中で折り返さないよう、1 文ずつ改行を禁止し、画面幅に合わせて文字を縮める */}
        <p className="text-[clamp(12px,3.8vw,16px)] leading-relaxed text-gray-800">
          <span className="whitespace-nowrap">このアプリは役目を終えました。</span>
          <br />
          <span className="whitespace-nowrap">今後は Go Bouldering をご愛用ください。</span>
        </p>
        <a
          href="https://claude.ai/artifact/B48ysBM36afiuaMEeUixfK"
          className="mt-6 inline-block whitespace-nowrap rounded-full bg-[#FF512F] px-4 py-3 text-[clamp(11px,3.3vw,14px)] font-semibold text-white"
        >
          Go Bouldering のインストール手順を見る
        </a>
      </div>
    </main>
  );
}
