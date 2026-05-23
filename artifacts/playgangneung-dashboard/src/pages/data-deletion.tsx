import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Link href={`${BASE}/`}>
          <img src={`${BASE}/logo2.png`} alt="PLAY강릉" className="h-8 cursor-pointer" />
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">사용자 데이터 삭제 안내</h1>
        <p className="text-sm text-gray-500 mb-10">Data Deletion Instructions</p>

        <section className="space-y-8 text-sm leading-7 text-gray-800">

          <div>
            <h2 className="font-semibold text-base mb-2">데이터 삭제 요청 방법</h2>
            <p>
              PLAY강릉 서비스 이용 중 수집된 개인정보(이름, 이메일 등)의 삭제를 요청하시려면
              아래 이메일로 연락해 주세요. 요청 접수 후 <strong>7영업일 이내</strong>에 처리 결과를 안내해 드립니다.
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <p className="font-medium">삭제 요청 이메일</p>
              <a href="mailto:play@gangneung.kr" className="text-blue-600 underline text-base">
                play@gangneung.kr
              </a>
              <p className="text-gray-500 mt-2 text-xs">제목: [데이터 삭제 요청] 이름 또는 가입 이메일 기재</p>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">삭제되는 데이터 항목</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 계정 정보 (이름, 이메일)</li>
              <li>광고 신청 내역 (업체명, 연락처, 광고 내용)</li>
              <li>서비스 이용 기록</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">Facebook 로그인 사용자</h2>
            <p>
              Facebook 계정으로 로그인한 경우, Facebook 앱 설정에서도 직접 권한을 해제할 수 있습니다.
            </p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Facebook → 설정 및 개인정보 보호 → 설정</li>
              <li>보안 → 앱 및 웹사이트</li>
              <li>PLAY강릉 선택 → 삭제</li>
            </ol>
            <p className="mt-2 text-gray-500">
              위 방법으로 Facebook 연동은 해제되지만, PLAY강릉 서버에 저장된 데이터는 위 이메일로 별도 요청해 주세요.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">처리 기간 및 확인</h2>
            <p>
              삭제 완료 후 확인 이메일을 발송해 드립니다.
              법령에 따라 일정 기간 보관이 필요한 정보는 해당 기간 경과 후 파기합니다.
            </p>
          </div>

        </section>
      </main>

      <footer className="border-t mt-16 px-6 py-6 text-center text-xs text-gray-400">
        © 2026 PLAY강릉. All rights reserved.
      </footer>
    </div>
  );
}
