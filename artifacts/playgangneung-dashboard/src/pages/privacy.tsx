import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Link href={`${BASE}/`}>
          <img src={`${BASE}/logo2.png`} alt="PLAY강릉" className="h-8 cursor-pointer" />
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2026년 5월 23일</p>

        <section className="space-y-8 text-sm leading-7 text-gray-800">

          <div>
            <h2 className="font-semibold text-base mb-2">제1조 (목적)</h2>
            <p>
              PLAY강릉(이하 "서비스")은 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 및 관련 법령을 준수합니다.
              본 방침은 서비스가 이용자로부터 수집하는 개인정보의 항목, 수집·이용 목적, 보유·이용 기간, 제3자 제공 여부 등을 안내합니다.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제2조 (수집하는 개인정보 항목)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-medium">회원가입·로그인</span>: 이름, 이메일 주소 (Google OAuth 또는 이메일 인증을 통해 수집)</li>
              <li><span className="font-medium">광고 신청</span>: 업체명, 대표자명, 연락처(전화번호), 이메일, 광고 내용</li>
              <li><span className="font-medium">서비스 이용</span>: 접속 IP, 브라우저 정보, 방문 일시 (자동 수집)</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제3조 (개인정보 수집·이용 목적)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 식별 및 서비스 이용 관리</li>
              <li>광고 신청 접수 및 집행, 결과 보고</li>
              <li>서비스 운영 관련 공지 및 고객 문의 응대</li>
              <li>서비스 품질 개선 및 이용 통계 분석</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제4조 (개인정보 보유·이용 기간)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 정보: 회원 탈퇴 시까지</li>
              <li>광고 신청 정보: 광고 집행 완료 후 1년</li>
              <li>관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제5조 (개인정보 제3자 제공)</h2>
            <p>
              서비스는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다.
              단, 법령에 의거하거나 수사기관의 적법한 요청이 있는 경우는 예외로 합니다.
              광고 집행을 위해 Meta(Facebook) 광고 플랫폼에 광고 소재(이미지·문구)가 전달될 수 있으나, 이 과정에서 이용자의 개인 식별 정보는 포함되지 않습니다.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제6조 (개인정보 처리 위탁)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-medium">Clerk</span>: 회원 인증 및 계정 관리</li>
              <li><span className="font-medium">Replit</span>: 서버 호스팅 및 데이터베이스 운영</li>
            </ul>
            <p className="mt-2">위탁 업체는 위탁 목적 외 개인정보를 이용하지 않도록 계약을 통해 관리합니다.</p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제7조 (이용자의 권리)</h2>
            <p>
              이용자는 언제든지 자신의 개인정보 열람, 수정, 삭제, 처리 정지를 요청할 수 있습니다.
              요청은 아래 개인정보 보호책임자에게 연락 주시기 바랍니다.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제8조 (개인정보 보호책임자)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>성명: PLAY강릉 운영팀</li>
              <li>이메일: <a href="mailto:play@gangneung.kr" className="text-blue-600 underline">play@gangneung.kr</a></li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제9조 (방침 변경)</h2>
            <p>
              본 개인정보처리방침은 법령·정책 변경이나 서비스 내용 변경 시 사전 공지 후 개정될 수 있습니다.
              변경 사항은 시행일 7일 전부터 서비스 내 공지사항을 통해 안내합니다.
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
