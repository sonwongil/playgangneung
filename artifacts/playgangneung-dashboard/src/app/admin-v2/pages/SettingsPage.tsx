import AdminLayout from "../layout/AdminLayout";

export default function SettingsPage() {
  return (
    <AdminLayout title="설정">
      <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        설정 준비 중
        <p className="mt-2 text-xs text-gray-300">크롤러 소스 · 사이트 설정 · 비밀번호 변경</p>
      </div>
    </AdminLayout>
  );
}
