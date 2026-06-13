import AdminLayout from "../layout/AdminLayout";

export default function TodayPage() {
  return (
    <AdminLayout title="오늘의 강릉소식">
      <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        오늘의 강릉소식 관리 준비 중
        <p className="mt-2 text-xs text-gray-300">daily_top5 선정 · 날짜별 관리 · SNS 발행 후보</p>
      </div>
    </AdminLayout>
  );
}
