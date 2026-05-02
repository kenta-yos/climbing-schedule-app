export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* プロフィールヘッダー */}
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-36 bg-gray-100 rounded" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 今後の予定 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 text-center space-y-1">
                <div className="h-3 w-8 bg-gray-200 rounded mx-auto" />
                <div className="h-3 w-3 bg-gray-100 rounded mx-auto" />
              </div>
              <div className="w-0.5 h-8 bg-gray-100 rounded-full" />
              <div className="h-4 w-32 bg-gray-200 rounded flex-1" />
            </div>
          ))}
        </div>

        {/* 月間トレンド */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-100 rounded-xl" />
        </div>

        {/* ジム訪問履歴 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-4 w-8 bg-gray-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
