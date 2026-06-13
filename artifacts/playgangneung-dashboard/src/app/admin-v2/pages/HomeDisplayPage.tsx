import AdminLayout from "../layout/AdminLayout";

export default function HomeDisplayPage() {
  return (
    <AdminLayout title="홈 노출 관리">
      <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        홈 노출 설정 준비 중
        <p className="mt-2 text-xs text-gray-300">소상공인 카드 ON/OFF · 노출 순서 · 가중치</p>
      </div>
    </AdminLayout>
  );
}
