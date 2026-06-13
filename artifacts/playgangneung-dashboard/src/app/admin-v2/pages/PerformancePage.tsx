import AdminLayout from "../layout/AdminLayout";

export default function PerformancePage() {
  return (
    <AdminLayout title="광고 성과">
      <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        광고 성과 대시보드 준비 중
        <p className="mt-2 text-xs text-gray-300">CTR · CPM · 노출수 · 주간 보고서</p>
      </div>
    </AdminLayout>
  );
}
