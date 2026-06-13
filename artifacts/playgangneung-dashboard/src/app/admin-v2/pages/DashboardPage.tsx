import AdminLayout from "../layout/AdminLayout";

export default function DashboardPage() {
  return (
    <AdminLayout title="대시보드">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {["총 강릉노트", "오늘의 강릉소식", "운영 중 광고", "이번 주 발행"].map((label) => (
            <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-300">—</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-sm text-gray-400">
          대시보드 통계 준비 중
        </div>
      </div>
    </AdminLayout>
  );
}
