import { Router } from "express";

const router = Router();

const SITE_URL = process.env["SITE_URL"] ?? "https://playgangneung.com";

router.get("/about", (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PLAY강릉 소개 | 강릉 지역 로컬 미디어 플랫폼</title>
  <meta name="description" content="PLAY강릉은 강릉시청·공공기관과 무관한 민간 지역 미디어 플랫폼입니다. 강릉의 행사·맛집·핫플·지역소식을 실시간으로 수집해 시민과 관광객에게 빠르게 전달합니다." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE_URL}/about" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="PLAY강릉" />
  <meta property="og:title" content="PLAY강릉 소개 | 강릉 지역 로컬 미디어 플랫폼" />
  <meta property="og:description" content="PLAY강릉은 강릉시청·공공기관과 무관한 민간 지역 미디어 플랫폼입니다. 강릉의 행사·맛집·핫플·지역소식을 실시간으로 수집해 시민과 관광객에게 빠르게 전달합니다." />
  <meta property="og:url" content="${SITE_URL}/about" />
  <meta property="og:image" content="${SITE_URL}/opengraph.jpg" />
  <meta property="og:locale" content="ko_KR" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": "${SITE_URL}/about",
    "url": "${SITE_URL}/about",
    "name": "PLAY강릉 소개",
    "description": "PLAY강릉은 강릉시청·공공기관과 무관한 민간 지역 미디어 플랫폼입니다.",
    "isPartOf": {
      "@type": "WebSite",
      "@id": "${SITE_URL}/#website",
      "name": "PLAY강릉",
      "url": "${SITE_URL}/"
    },
    "about": {
      "@type": "Organization",
      "name": "PLAY강릉",
      "url": "${SITE_URL}/",
      "description": "강릉의 행사·맛집·핫플·지역소식을 실시간으로 수집·제공하는 민간 지역 미디어 플랫폼. 강릉시 공식기관과 무관합니다.",
      "foundingDate": "2024",
      "areaServed": {
        "@type": "City",
        "name": "강릉시",
        "containedInPlace": {
          "@type": "AdministrativeArea",
          "name": "강원특별자치도"
        }
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "event62@gmail.com",
        "contactType": "general"
      }
    }
  }
  </script>

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.7; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
    .logo { display: inline-block; margin-bottom: 32px; }
    .logo img { height: 36px; }
    h1 { font-size: 1.75rem; font-weight: 700; color: #1e40af; margin-bottom: 8px; }
    .subtitle { font-size: 1rem; color: #64748b; margin-bottom: 48px; }
    .section { margin-bottom: 40px; }
    .section h2 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    .section p { color: #475569; font-size: 0.95rem; margin-bottom: 10px; }
    .notice { background: #fef9c3; border: 1px solid #fde047; border-radius: 10px; padding: 16px 20px; margin-bottom: 40px; }
    .notice p { color: #713f12; font-size: 0.88rem; font-weight: 500; margin: 0; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .tag { background: #eff6ff; color: #1d4ed8; border-radius: 20px; padding: 4px 14px; font-size: 0.83rem; font-weight: 600; }
    .back { display: inline-block; margin-top: 40px; color: #2563eb; text-decoration: none; font-size: 0.9rem; font-weight: 600; }
    .back:hover { text-decoration: underline; }
    .contact { color: #2563eb; }
  </style>
</head>
<body>
  <div class="wrap">
    <a href="${SITE_URL}/" class="logo">
      <img src="${SITE_URL}/logo2.png" alt="PLAY강릉 로고" onerror="this.style.display='none'" />
    </a>

    <h1>PLAY강릉 소개</h1>
    <p class="subtitle">강릉의 모든 즐거움을 가장 빠르게</p>

    <div class="notice">
      <p>⚠️ PLAY강릉(playgangneung.com)은 강릉시청·강릉시 관광공사·기타 공공기관과 무관한 <strong>민간 지역 미디어 플랫폼</strong>입니다.</p>
    </div>

    <div class="section">
      <h2>왜 만들었나요?</h2>
      <p>강릉에는 매일 크고 작은 행사, 새로 생긴 맛집, 숨겨진 명소, 지역 소식이 넘칩니다. 그런데 이 정보들은 강릉시청 공지, 문화재단 SNS, 블로그 등 여러 곳에 흩어져 있어 한눈에 보기가 어렵습니다.</p>
      <p>PLAY강릉은 강릉 전용 소스만을 모아 시민과 관광객 모두가 <strong>놓치기 쉬운 강릉 로컬 정보를 실시간으로</strong> 확인할 수 있도록 만들어졌습니다.</p>
    </div>

    <div class="section">
      <h2>어떤 정보를 제공하나요?</h2>
      <p>강릉시청 공식 RSS, 강릉문화재단 소식 등 강릉 전용 소스에서 수집한 정보를 카테고리별로 정리합니다.</p>
      <div class="tag-list">
        <span class="tag">행사·축제</span>
        <span class="tag">맛집·카페</span>
        <span class="tag">핫플·명소</span>
        <span class="tag">지역소식</span>
        <span class="tag">강릉 여행</span>
      </div>
    </div>

    <div class="section">
      <h2>공식 기관 정보가 필요하다면</h2>
      <p>강릉시 공식 관광 정보는 <a href="https://www.visitgangneung.go.kr" target="_blank" rel="noopener" class="contact">비짓강릉(visitgangneung.go.kr)</a>을 이용해 주세요.</p>
      <p>강릉시청 공식 사이트는 <a href="https://www.gangneung.go.kr" target="_blank" rel="noopener" class="contact">gangneung.go.kr</a>입니다.</p>
    </div>

    <div class="section">
      <h2>문의</h2>
      <p>광고·제휴·오류 제보: <a href="mailto:event62@gmail.com" class="contact">event62@gmail.com</a></p>
    </div>

    <a href="${SITE_URL}/" class="back">← PLAY강릉 홈으로</a>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(html);
});

export default router;
