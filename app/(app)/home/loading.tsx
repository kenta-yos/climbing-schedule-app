export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* ヘッダー */}
      <div className="climbing-gradient px-4 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/30" />
          <div>
            <div className="h-6 w-36 bg-white/30 rounded" />
            <div className="h-4 w-24 bg-white/20 rounded mt-1" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* 記録ボタン */}
        <div className="h-14 bg-gray-200 rounded-xl" />

        {/* 新セット情報スケルトン */}
        <div className="flex gap-2">
          <div className="h-7 w-36 bg-gray-200 rounded-full" />
          <div className="h-7 w-40 bg-gray-200 rounded-full" />
        </div>

        {/* みんなの予定セクション */}
        <div>
          <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-4 w-16 bg-gray-100 rounded ml-auto" />
                </div>
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-gray-100 rounded-full" />
                  <div className="h-6 w-20 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CLIMB-BAKA AWARD セクション */}
        <div>
          <div className="h-5 w-44 bg-gray-200 rounded mb-3" />
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-gray-200 rounded" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                  </div>
                  <div className="h-6 w-12 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
