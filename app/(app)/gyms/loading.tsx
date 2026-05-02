export default function GymsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* ヘッダー */}
      <div className="bg-white px-4 pt-12 pb-3 border-b border-gray-100">
        <div className="h-6 w-24 bg-gray-200 rounded" />
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* 検索・フィルター */}
        <div className="h-10 bg-gray-200 rounded-xl" />
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-gray-200 rounded-full" />
          <div className="h-8 w-20 bg-gray-200 rounded-full" />
          <div className="h-8 w-16 bg-gray-200 rounded-full" />
        </div>

        {/* ジムカード */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-36 bg-gray-200 rounded" />
              <div className="h-4 w-12 bg-gray-100 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
