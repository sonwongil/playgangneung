import AdminLayout from "../layout/AdminLayout";

export default function InboxPage() {
  return (
    <AdminLayout title="강릉소식 수집함">
      <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        강릉소식 수집함 준비 중
        <p className="mt-2 text-xs text-gray-300">크롤링 수집 + 수동 입력 → 강릉노트 전환</p>
      </div>
    </AdminLayout>
  );
}
