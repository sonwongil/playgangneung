# PLAY강릉 SNS 백오피스

PLAY강릉 공식 SNS 자동운영 백오피스. 강릉 행사/맛집/핫플/지역소식을 수집·관리하고 SNS 초안 및 카드뉴스를 생성하는 플랫폼.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API 서버 실행
- `pnpm --filter @workspace/playgangneung-dashboard run dev` — 프론트엔드 실행
- `pnpm run typecheck` — 전체 타입 검사
- `pnpm run build` — 전체 빌드
- `SITE_URL` 환경변수로 콘텐츠 공유 링크 도메인 설정 (기본값: https://play-gangneung-dashboard.replit.app)

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Backend**: Express 5, esbuild (CJS bundle), express-session
- **Frontend**: React 18 + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, wouter
- **Data**: JSON 파일 저장소 (`artifacts/api-server/data/events.json`, `ads.json`, `auth.json`)
- **Image gen**: @napi-rs/canvas (카드뉴스 1080×1080 PNG)

## Where things live

```
artifacts/
  api-server/          # Express API 서버 (경로: /api, /content)
    src/lib/crawler.ts   — RSS/HTML/수동 크롤러
    src/lib/storage.ts   — JSON 파일 저장소
    src/lib/draft.ts     — SNS 초안 생성 (콘텐츠 URL 포함)
    src/lib/auth.ts      — 비밀번호 해시(scrypt) + 검증
    src/lib/card.ts      — 카드이미지 생성 (@napi-rs/canvas)
    src/routes/events.ts — 이벤트 API
    src/routes/auth.ts   — 인증 API (login/logout/me/change-password)
    src/routes/content.ts — SSR 상세페이지 (/content/:id, OG태그 포함)
    src/routes/admin.ts  — 레거시 HTML 관리자 화면 (/api/admin)
    public/cards/        — 생성된 카드이미지 PNG
  playgangneung-dashboard/  # React+Vite 프론트엔드 (경로: /)
    src/pages/home.tsx   — 공개 홈페이지 (/)
    src/pages/admin.tsx  — 관리자 대시보드 (/admin, 로그인 필요)
    src/pages/login.tsx  — 관리자 로그인 (/login)
    public/logo.png      — PLAY강릉 공식 로고
    public/logo2.png     — 가로형 헤더 로고
```

## Architecture decisions

- `/content/:id` 는 API 서버에서 SSR HTML로 제공 → OG 태그가 Meta 크롤러에 직접 전달됨
- 공개 홈페이지(`/`)는 Unsplash 썸네일이 포함된 큐레이션 목업 데이터 표시
- 관리자 대시보드(`/admin`)는 express-session 기반 비밀번호 인증 보호
- 비밀번호는 scrypt 해시로 `data/auth.json`에 저장, 초기값 1235
- SNS 초안 "자세히 보기" 링크: `{SITE_URL}/content/{id}` 형식
- 이벤트 상태: draft → approved → SNS초안생성 → 카드이미지생성 순서

## Product

- **공개 홈**: 카테고리 탭(전체/행사/맛집/핫플/지역소식), 행사 서브탭(달력/오늘/내일/이번 주), 인스타 필터 pill, 달력 컴포넌트
- **콘텐츠 상세 (`/content/:id`)**: Meta 인앱 브라우저 최적화, OG 태그, 히어로 이미지, 하단 액션 버튼(지도/전화/원문)
- **관리자**: 통계 카드 4개, 이벤트 테이블, 행사 스케줄(클릭 → 상세 모달), 광고접수 관리
- **크롤러**: RSS→HTML→수동 3단계, 정부사이트 차단 시 수동 등록으로 대체
- **콘텐츠 생성**: SNS 문구 초안(공유 링크 포함), 1080×1080 카드이미지(PNG)

## API Endpoints

- `GET  /api/events` — 수집 목록 조회
- `POST /api/events/crawl` — 크롤링
- `POST /api/events/manual` — 수동 등록
- `PATCH /api/events/:id/status` — 상태 변경
- `POST /api/events/:id/draft` — SNS 초안 생성
- `POST /api/events/:id/card` — 카드이미지 생성
- `DELETE /api/events/:id` — 개별 삭제
- `POST /api/auth/login` — 관리자 로그인
- `POST /api/auth/logout` — 로그아웃
- `GET  /api/auth/me` — 세션 확인
- `POST /api/auth/change-password` — 비밀번호 변경
- `GET  /content/:id` — 콘텐츠 상세 SSR (이벤트 or 광고)

## Gotchas

- 한국 정부사이트 차단으로 크롤링 실패는 정상 — 수동 등록 사용
- 카드이미지는 `approved` + `socialDraft` 있어야 생성 가능
- `/content/:id` 는 API 서버가 처리 (artifact.toml paths에 "/content" 포함)
- Vite `dedupe: ["react", "react-dom"]` 설정으로 중복 React 방지
