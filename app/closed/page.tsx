export const metadata = {
  title: "Go Bouldering",
  robots: { index: false },
};

export default function ClosedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-base leading-relaxed text-gray-800">
          このアプリは役目を終えました。
          <br />
          今後は Go Bouldering をご愛用ください。
        </p>
        <a
          href="https://gobouldering.app/"
          className="mt-6 inline-block rounded-full bg-[#FF512F] px-6 py-3 text-sm font-semibold text-white"
        >
          Go Bouldering を開く
        </a>
      </div>
    </main>
  );
}
