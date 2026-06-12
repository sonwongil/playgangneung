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
- **Backend**: Express 5, esbuild (CJS bundle), cookie-session
- **Frontend**: React 18 + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, wouter
- **Data**: PostgreSQL (Replit managed) via Drizzle ORM — `lib/db/src/schema/`
- **Image gen**: @napi-rs/canvas (카드뉴스 1080×1080 PNG)

## Where things live

```
artifacts/
  api-server/          # Express API 서버 (경로: /api, /content)
    src/lib/crawler.ts   — 강릉 전용 RSS/HTML 크롤러 (강원도 소스 없음)
    src/lib/storage.ts   — PostgreSQL 저장소 (Drizzle ORM, startDate/endDate/scheduleStatus/location/category 포함)
    src/lib/dateParser.ts — 한국 날짜 파싱, scheduleStatus 계산, detectCategory
    src/lib/draft.ts     — SNS 초안 생성 (콘텐츠 URL 포함)
    src/lib/auth.ts      — 비밀번호 해시(scrypt) + 검증
    src/lib/card.ts      — 카드이미지 생성 (@napi-rs/canvas)
    src/routes/events.ts — 이벤트 API
    src/routes/auth.ts   — 인증 API (login/logout/me/change-password)
    src/routes/content.ts — SSR 상세페이지 (/content/:id, OG태그 포함)
    src/routes/feed.ts   — 공개 피드 API (approved+published, scheduleStatus 기반 정렬)
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
- 공개 피드 링크는 모두 `{SITE_URL}/content/{id}` 형식으로 변환 → Meta/카카오 공유 최적화
- 관리자 대시보드(`/admin`)는 express-session 기반 비밀번호 인증 보호
- 비밀번호는 scrypt 해시로 `data/auth.json`에 저장, 초기값 1235
- 크롤러는 강릉 전용 소스만 사용 (강릉시청 RSS/HTML, 강릉문화재단 RSS/HTML)
- scheduleStatus: today→ongoing→tomorrow→upcoming→dateUnknown→ended 순서로 피드 정렬

## Product

- **공개 홈**: 카테고리 탭(전체/행사/맛집/핫플/지역소식), 행사 서브탭(달력/오늘/내일/이번 주), 인스타 필터 pill, 달력 컴포넌트
- **콘텐츠 상세 (`/content/:id`)**: Meta 인앱 브라우저 최적화, OG 태그, 히어로 이미지, 하단 액션 버튼(지도/전화/원문)
- **관리자**: 통계 카드 4개, 이벤트 테이블, 행사 스케줄(오늘/내일/진행중/이번 주/날짜 미확인 탭), scheduleStatus 뱃지, 광고접수 관리
- **크롤러**: 강릉시청(공지/행사 RSS), 강릉문화재단(RSS), HTML 크롤러 2개 — 강원도 소스 없음
- **콘텐츠 생성**: SNS 문구 초안(공유 링크 포함), 1080×1080 카드이미지(PNG)

## API Endpoints

- `GET  /api/events` — 수집 목록 조회
- `GET  /api/feed` — 공개 피드 (approved+published, scheduleStatus 정렬)
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
- 강원도청/강원신문/강원도민일보 등 강원도 전역 소스는 명시적으로 제외됨

## Clerk 키 운영 기준 (VPS 배포)

> 독립 Clerk 앱(clerk.com)을 사용한다. Replit 관리형 Clerk는 사용하지 않는다.

### 운영 구조

- **Clerk 앱**: clerk.com 독립 앱, Production primary domain = `playgangneung.com`
- **로그인 상태**: 이메일 로그인 ✅ 운영 중 / Google OAuth ✅ 운영 중
- **DNS 상태**: Clerk DNS configuration ✅ Verified
- **SSL 상태**: SSL certificates ✅ Issued
- **개발 환경**: Replit Secrets에 `pk_test_...` / `sk_test_...` 설정
- **운영 환경**: VPS `.env` 및 `.env.production`에 `pk_live_...` / `sk_live_...` 설정

### VPS 운영 원칙

- `pk_live_` 형식이면 통과 — 내부 도메인 인코딩으로 차단하지 않는다.
- `pk_test_` / 빈 값 / `pk_live_REPLACE_ME` / `replit.app` / `replit.dev` 포함 시 빌드 차단.
- **Replit 관리형 Clerk는 절대 재사용하지 않는다.** playgangneung.com A 레코드가 VPS를 가리키므로 Replit 도메인 검증이 불가능하다.
- **인증 코드는 더 이상 수정하지 않는다.** 현재 상태가 운영 기준이다.

### Clerk Production 키 확인 위치

```
clerk.com → 해당 앱 → Configure → API Keys → Production
  Publishable Key: pk_live_...  (프론트엔드 .env.production에 입력)
  Secret Key:      sk_live_...  (VPS 루트 .env에 입력, 절대 노출 금지)
```

## Meta Ads API 연동

아래 4개 환경변수 **모두 Replit Secrets에 이미 저장됨** — 절대 다시 묻지 말 것.

| 변수명 | 값/설명 |
|--------|---------|
| `META_PAGE_ID` | 1135888279600983 (Play강릉 페이스북 페이지) |
| `META_AD_ACCOUNT_ID` | 1660013435208674 |
| `META_ACCESS_TOKEN` | 저장됨 — 만료 시 Meta Business Suite → 시스템 사용자에서 재발급 |
| `META_APP_SECRET` | 저장됨 — 웹훅 서명 검증용, 현재 코드에서 미사용 |

- 연동 코드: `artifacts/api-server/src/lib/metaApi.ts`, 집행: `POST /api/ad-pools/:id/push-to-meta`
- 토큰 유효성 확인: `curl "https://graph.facebook.com/v19.0/me?access_token=$META_ACCESS_TOKEN"`

## User preferences

- 강릉 전용 소스만 사용 (강원도 전역 소스 제거 요청)
- **개발 및 수정 시 검증된 외부 라이브러리(GitHub 공인, 스타 수 높음)를 우선 도입한다. 직접 구현 코드로 대체하지 말 것.**
- **모든 날짜·시각 처리는 한국 시각(KST, UTC+9) 기준으로 진행한다.**
- **배포 전 개발앱과 배포앱의 동일성을 반드시 한 번 더 확인하고 맞춘 후 배포한다.**

## 작업 완료 기준 (Replit Agent 필수 준수)

### 완료 정의

"완료"란 코드 수정만을 뜻하지 않는다. 반드시 아래 단계까지 끝나야 완료다.

1. 코드 수정
2. Replit 환경에서 검증
3. `pnpm run typecheck` 통과
4. `pnpm run build` 통과
5. 필요 시 `bash scripts/validate.sh` 실행
6. 변경 파일 목록 확인
7. Git commit 생성
8. GitHub `main` 브랜치에 push
9. push된 커밋 해시 보고

**GitHub에 push하지 않은 작업은 완료로 보고하지 않는다.**

### 운영 구조

| 역할 | 위치 |
|---|---|
| 개발·수정 | Replit |
| 공식 코드 기준 | GitHub main |
| 실제 운영 서버 | Cafe24 VPS `/var/www/playgangneung` |
| PM2 프로세스명 | `playgangneung` |
| PM2 모드 | **fork (cluster 절대 금지)** |
| PM2 instances | **1 (변경 금지)** |

### 작업 후 필수 명령 순서

```bash
pnpm run typecheck
pnpm run build          # 또는 pnpm --filter @workspace/playgangneung-dashboard run build
bash scripts/validate.sh
git status
git push "https://${GITHUB_TOKEN}@github.com/sonwongil/playgangneung.git" main
```

### 완료 보고 형식 (모든 작업에 적용)

```md
## 작업 완료 보고

### 수정 목적
-

### 수정 파일
-

### 주요 수정 내용
-

### 검증 결과
- pnpm run typecheck:
- pnpm run build:
- bash scripts/validate.sh:

### GitHub 반영
- commit hash:
- push 여부: 완료 / 실패
- branch: main

### VPS 반영 필요 여부
- 필요 / 불필요

### VPS에서 실행할 명령
cd /var/www/playgangneung
git pull origin main
pnpm --filter @workspace/api-server --filter @workspace/playgangneung-dashboard run build
pm2 restart playgangneung
pm2 status

### 확인 URL
-
```

### 절대 금지 사항

다음은 절대 임의로 변경하지 않는다.

- nginx / DNS / SSL / certbot 설정
- PM2 cluster mode 또는 instances 수 변경
- `ecosystem.config.cjs`의 `exec_mode: fork`, `instances: 1`
- 운영 DB 직접 수정
- 홈 피드 구조 / TOP5 캐러셀 / `/content/:id` 강릉노트 구조
- 광고접수 / Meta 연동 구조
- `git push --force` / `git push -f` — **어떤 상황에서도 절대 금지**

### 환경변수 운영 원칙

운영 환경에 들어가면 안 되는 값:

- `pk_test_...` / `sk_test_...`
- `localhost` / `127.0.0.1`
- `replit.dev` / `replit.app`
- `REPLACE_ME`

운영 Clerk 공개키 필수 형식: `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`
Secret Key(`sk_live_...`)는 화면·로그·GitHub·JS 번들에 절대 노출 금지.

### 실제 완료 기준 (전체 흐름)

```
Replit 수정 → 검증 통과 → GitHub main push
→ Cafe24 VPS git pull → VPS build → PM2 restart → playgangneung.com 실제 확인
```

Replit 담당 작업의 최소 완료 기준은 **GitHub main push**까지다.

## 배포 절차 (반드시 이 순서 준수)

1. **Replit 수정** — 코드 변경
2. **Replit 검증** — `pnpm run typecheck` + 빌드 확인
3. **GitHub pull/rebase 먼저** — GitHub 최신 main을 Replit으로 가져온 후 충돌 해결
4. **일반 push** — `git push --force` / `git push -f` **절대 금지**, 항상 일반 push
5. **Cafe24 git pull** — `cd /var/www/playgangneung && git pull origin main`
6. **운영앱 빌드** — `pnpm --filter @workspace/api-server --filter @workspace/playgangneung-dashboard run build`
7. **PM2 재시작** — `pm2 restart playgangneung`

> `git push --force` / `git push -f` 는 어떤 상황에서도 사용하지 않는다.

## Version History

| 버전 | 커밋 | 날짜 | 주요 내용 |
|---|---|---|---|
| 독립 Clerk 완료 | `cb0da2f` | 2026-06-12 | 독립 Clerk 완전 운영 — 이메일 로그인 ✅, Google OAuth ✅, DNS Verified ✅, SSL Issued ✅. Replit 관리형 Clerk 의존 제거 완료. |
| 독립 Clerk | `02c9115` | 2026-06-11 | 독립 Clerk 앱 전환 — playgangneung.com Primary domain, 이메일 로그인 성공, SSL 복구 완료. |
| 회원가입 | `19f26f55` | 2026-05-23 | Clerk 회원가입/로그인 연동 — Google OAuth + 이메일 인증, 광고접수 회원전용, 헤더 로그인/회원가입 버튼, 햄버거 메뉴 정리 |
