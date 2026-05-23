import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Link href={`${BASE}/`}>
          <img src={`${BASE}/logo2.png`} alt="PLAY강릉" className="h-8 cursor-pointer" />
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">서비스 이용약관</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2026년 5월 23일</p>

        <section className="space-y-8 text-sm leading-7 text-gray-800">

          <div>
            <h2 className="font-semibold text-base mb-2">제1조 (목적)</h2>
            <p>
              본 약관은 PLAY강릉(이하 "서비스")이 제공하는 강릉 지역 SNS 미디어 플랫폼 서비스의 이용 조건 및 절차,
              이용자와 서비스 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제2조 (정의)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>"서비스"란 PLAY강릉이 운영하는 웹 플랫폼 및 관련 부가 서비스를 의미합니다.</li>
              <li>"이용자"란 본 약관에 동의하고 서비스를 이용하는 모든 자를 의미합니다.</li>
              <li>"회원"이란 서비스에 가입하여 계정을 보유한 이용자를 의미합니다.</li>
              <li>"광고주"란 서비스를 통해 광고를 신청·집행하는 이용자를 의미합니다.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제3조 (약관의 효력 및 변경)</h2>
            <p>
              본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.
              서비스는 필요한 경우 약관을 변경할 수 있으며, 변경 시 시행일 7일 전에 공지합니다.
              이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제4조 (회원가입 및 계정)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원가입은 이메일 인증 또는 Google 계정을 통해 이루어집니다.</li>
              <li>이용자는 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.</li>
              <li>계정 보안은 이용자 본인이 책임지며, 무단 사용이 발생한 경우 즉시 서비스에 통보해야 합니다.</li>
              <li>서비스는 이용약관 위반 시 사전 통보 없이 계정을 정지하거나 삭제할 수 있습니다.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제5조 (서비스 이용)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>이용자는 서비스를 통해 강릉 지역 정보 콘텐츠를 열람할 수 있습니다.</li>
              <li>회원은 광고 신청, 광고 결과 조회 등 추가 기능을 이용할 수 있습니다.</li>
              <li>서비스는 운영상 필요한 경우 서비스의 전부 또는 일부를 변경·중단할 수 있습니다.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제6조 (광고 서비스)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>광고 신청은 회원 가입 후 이용 가능합니다.</li>
              <li>광고 내용은 관련 법령 및 Meta(Facebook) 광고 정책을 준수해야 합니다.</li>
              <li>허위·과장 광고, 불법 상품·서비스 광고는 사전 통보 없이 거부 또는 삭제될 수 있습니다.</li>
              <li>광고 요금 및 결제 정책은 서비스 내 별도 안내를 따릅니다.</li>
              <li>광고 집행 결과는 Meta 광고 플랫폼 기준으로 제공되며, 특정 성과를 보장하지 않습니다.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제7조 (이용자의 의무)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>타인의 권리(저작권, 상표권 등)를 침해하는 행위 금지</li>
              <li>서비스의 정상적인 운영을 방해하는 행위 금지</li>
              <li>스팸, 악성 코드 배포 등 불법 행위 금지</li>
              <li>타인의 개인정보를 무단으로 수집·이용하는 행위 금지</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제8조 (서비스의 면책)</h2>
            <p>
              서비스는 천재지변, 불가항력적 사유, 이용자의 귀책으로 인한 손해에 대해 책임을 지지 않습니다.
              서비스가 제공하는 정보의 정확성·완전성에 대해 보증하지 않으며,
              이용자가 서비스를 통해 얻은 정보를 활용하여 발생한 결과에 대해 책임지지 않습니다.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제9조 (분쟁 해결)</h2>
            <p>
              본 약관에 관한 분쟁은 대한민국 법률을 준거법으로 하며,
              분쟁 발생 시 상호 협의를 통해 해결하는 것을 원칙으로 합니다.
              협의가 이루어지지 않을 경우 관할 법원은 민사소송법에 따릅니다.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-base mb-2">제10조 (문의)</h2>
            <p>서비스 이용 관련 문의사항은 아래로 연락 주세요.</p>
            <div className="mt-2 p-4 bg-gray-50 rounded-lg border">
              <p>이메일: <a href="mailto:play@gangneung.kr" className="text-blue-600 underline">play@gangneung.kr</a></p>
            </div>
          </div>

        </section>
      </main>

      <footer className="border-t mt-16 px-6 py-6 text-center text-xs text-gray-400">
        © 2026 PLAY강릉. All rights reserved.
      </footer>
    </div>
  );
}
