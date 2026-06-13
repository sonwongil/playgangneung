import AdminLayout from "../layout/AdminLayout";

export default function NoteListPage() {
  return (
    <AdminLayout title="강릉노트 관리">
      <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        강릉노트 목록 준비 중
        <p className="mt-2 text-xs text-gray-300">수집함 전환 콘텐츠 + 수동 작성 강릉노트</p>
      </div>
    </AdminLayout>
  );
}
