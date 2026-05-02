export default function ScheduleLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* ヘッダー */}
      <div className="bg-white px-4 pt-12 pb-3 border-b border-gray-100">
        <div className="h-6 w-32 bg-gray-200 rounded" />
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* 月セレクター */}
        <div className="h-10 w-40 bg-gray-200 rounded-xl" />

        {/* スケジュール行 */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-1 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
