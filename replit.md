# PLAY강릉 SNS 백오피스

PLAY강릉 공식 SNS 자동운영 백오피스. 강릉 행사/맛집/핫플/지역소식을 수집·관리하고 SNS 초안 및 카드뉴스를 생성하는 플랫폼.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API 서버 실행
- `pnpm --filter @workspace/playgangneung-dashboard run dev` — 프론트엔드 실행
- `pnpm run typecheck` — 전체 타입 검사
- `pnpm run build` — 전체 빌드

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Backend**: Express 5, esbuild (CJS bundle)
- **Frontend**: React 18 + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, wouter
- **Data**: JSON 파일 저장소 (`artifacts/api-server/data/events.json`)
- **Image gen**: @napi-rs/canvas (카드뉴스 1080×1080 PNG)

## Where things live

```
artifacts/
  api-server/          # Express API 서버 (경로: /api)
    src/lib/crawler.ts   — RSS/HTML/수동 크롤러
    src/lib/storage.ts   — JSON 파일 저장소
    src/lib/draft.ts     — SNS 초안 생성
    src/lib/card.ts      — 카드이미지 생성 (@napi-rs/canvas)
    src/routes/events.ts — 이벤트 API
    src/routes/admin.ts  — 레거시 HTML 관리자 화면 (/api/admin)
    public/cards/        — 생성된 카드이미지 PNG
  playgangneung-dashboard/  # React+Vite 프론트엔드 (경로: /)
    src/pages/home.tsx   — 공개 홈페이지 (/)
    src/pages/admin.tsx  — 관리자 대시보드 (/admin)
    public/logo.png      — PLAY강릉 공식 로고
```

## Architecture decisions

- 공개 홈페이지(`/`)는 Unsplash 썸네일이 포함된 큐레이션 목업 데이터 표시 (API 이벤트에 thumbnail/category 없음)
- 관리자 대시보드(`/admin`)는 실제 API 데이터(`GET /api/events`)를 폴백 포함해 표시
- 레거시 HTML 어드민(`/api/admin`)은 크롤링 직접 실행용으로 유지
- 사이드바 배경: `--sidebar` CSS 변수(다크 네이비), 테마 컬러 #2563eb(blue-600)
- 이벤트 상태: draft → approved → SNS초안생성 → 카드이미지생성 순서

## Product

- **공개 홈**: 카테고리 탭(전체/행사/맛집/핫플/지역소식), 행사 서브탭(전체/달력/오늘/내일/이번 주), 인스타 필터 pill 스타일, 달력 컴포넌트(날짜별 이벤트 dot), 오늘/내일 뱃지 카드 표시
- **관리자**: 통계 카드 4개, 이벤트 테이블(상태뱃지/승인반려/SNS초안/카드이미지), 행사 스케줄(오늘/내일/이번 주 서브탭, 승인→초안→카드 액션), 전체 크롤링 버튼
- **크롤러**: RSS→HTML→수동 3단계, 정부사이트 차단 시 수동 등록으로 대체
- **콘텐츠 생성**: SNS 문구 초안, 1080×1080 카드이미지(PNG)

## API Endpoints

- `GET  /api/events` — 수집 목록 조회
- `POST /api/events/crawl` — 크롤링 (body: `{}` 전체 / `{url}` 커스텀)
- `POST /api/events/manual` — 수동 등록
- `PATCH /api/events/:id/status` — 상태 변경
- `POST /api/events/:id/draft` — SNS 초안 생성
- `POST /api/events/:id/card` — 카드이미지 생성
- `DELETE /api/events/:id` — 개별 삭제

## Gotchas

- 한국 정부사이트 차단으로 크롤링 실패는 정상 — 수동 등록 사용
- 카드이미지는 `approved` + `socialDraft` 있어야 생성 가능
- `@assets` alias는 `attached_assets/` 폴더를 가리킴
- Vite `dedupe: ["react", "react-dom"]` 설정으로 중복 React 방지
