# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Project: PLAY강릉 SNS 백오피스

PLAY강릉 SNS 자동운영용 백오피스 대시보드. Node.js + Express 기반 서버에 HTML 관리자 화면 포함.

### 기능
1. 강릉 행사/공지 정보 크롤링 (axios + cheerio)
2. 수집 데이터 JSON 파일 저장 (`artifacts/api-server/data/events.json`)
3. HTML 관리자 화면에서 수집 목록 확인

### 관리자 화면
- URL: `/api/admin`
- URL 크롤링: 직접 URL 입력하여 크롤링
- 전체 크롤링: 기본 소스(강릉시청 공지사항/행사정보, 강원도 행사) 일괄 크롤링
- 수동 등록: 제목/출처/날짜/링크/설명 직접 입력
- 개별/전체 삭제

### API Endpoints
- `GET  /api/events` — 수집 목록 조회
- `POST /api/events/crawl` — 크롤링 실행 (body: `{}` 전체, `{url: "..."}` 커스텀 URL)
- `POST /api/events/manual` — 수동 등록
- `DELETE /api/events` — 전체 초기화
- `DELETE /api/events/:id` — 개별 삭제

### 파일 구조 (api-server)
- `src/lib/crawler.ts` — cheerio 기반 크롤러
- `src/lib/storage.ts` — JSON 파일 저장소
- `src/routes/events.ts` — 이벤트 API 라우트
- `src/routes/admin.ts` — HTML 관리자 페이지

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
