import AdminLayout from "../layout/AdminLayout";

export default function SnsPage() {
  return (
    <AdminLayout title="SNS 발행">
      <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        SNS 발행 관리 준비 중
        <p className="mt-2 text-xs text-gray-300">Facebook · Instagram 단일 피드 / TOP5 캐러셀 발행</p>
      </div>
    </AdminLayout>
  );
}
