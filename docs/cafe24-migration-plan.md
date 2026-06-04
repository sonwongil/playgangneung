# PLAY강릉 — Cafe24 VPS 운영 전환 계획서

> **목표**: playgangneung.com 트래픽을 Replit 배포 앱에서 Cafe24 VPS로 완전 전환  
> **원칙**: 전환 전 Cafe24 단독 검증 완료 → DNS 변경은 맨 마지막 → 롤백 경로 항상 열어둠  
> **코드 변경**: 이 문서에서는 없음 — 전환 절차와 검증만 기술

---

## 전환 전 현재 상태 요약

```
현재 (전환 전)
  사용자 → playgangneung.com → Google App Engine → Replit 배포 앱
  Cafe24 VPS → localhost:8080 에서만 동작, 도메인 미연결

목표 (전환 후)
  사용자 → playgangneung.com → Cafe24 VPS (nginx → PM2)
  Replit → 개발 전용 (dev 서버만, 배포 앱 unpublish)
```

---

## Phase 0. 전환 전 체크리스트 — 6개 모두 ✅ 이어야 DNS 변경 가능

```
[ ] 0-1. Replit DB ↔ Cafe24 DB 데이터 차이 확인 및 동기화
[ ] 0-2. Cafe24 PM2 cluster→fork/1 정상화 완료
[ ] 0-3. Cafe24 기능 검증 완료 (6개 항목)
[ ] 0-4. Cafe24 nginx 설정 및 SSL 인증서 완료
[ ] 0-5. 롤백 경로 확보 (Replit 배포 앱 유지 상태)
[ ] 0-6. TTL 낮추기 완료 (DNS 전파 시간 단축)
```

---

## Phase 1. Replit DB ↔ Cafe24 DB 데이터 차이 확인

### 목적
두 DB의 데이터를 비교하여 Cafe24 DB가 최신 상태인지 확인합니다.  
차이가 있으면 DNS 변경 전에 동기화해야 합니다.

### 1-1. Replit DB 현황 확인 (Replit 터미널)

```bash
# 주요 테이블 레코드 수 확인
psql "$DATABASE_URL" -c "
SELECT
  (SELECT COUNT(*) FROM events)         AS events,
  (SELECT COUNT(*) FROM ad_pools)       AS ad_pools,
  (SELECT COUNT(*) FROM ads)            AS ads,
  (SELECT COUNT(*) FROM payments)       AS payments,
  (SELECT COUNT(*) FROM blog_sources)   AS blog_sources,
  (SELECT COUNT(*) FROM site_config)    AS site_config;
"

# 가장 최근에 추가된 이벤트
psql "$DATABASE_URL" -c "
  SELECT id, title, status, crawled_at
  FROM events
  ORDER BY crawled_at DESC
  LIMIT 5;
"
```

### 1-2. Cafe24 DB 현황 확인 (VPS 터미널)

```bash
source /var/www/playgangneung/.env

psql "$DATABASE_URL" -c "
SELECT
  (SELECT COUNT(*) FROM events)         AS events,
  (SELECT COUNT(*) FROM ad_pools)       AS ad_pools,
  (SELECT COUNT(*) FROM ads)            AS ads,
  (SELECT COUNT(*) FROM payments)       AS payments,
  (SELECT COUNT(*) FROM blog_sources)   AS blog_sources,
  (SELECT COUNT(*) FROM site_config)    AS site_config;
"
```

### 1-3. 판단 기준

| 상황 | 조치 |
|---|---|
| Cafe24 events 수 ≥ Replit events 수 | 동기화 불필요 — Cafe24 크롤러가 최신 상태 유지 중 |
| Cafe24 events 수 < Replit events 수 | Replit DB 덤프 후 Cafe24로 선택적 import |
| ad_pools, ads, payments 차이 있음 | **반드시 Replit → Cafe24 동기화 후 전환** |
| site_config 차이 있음 | Cafe24 `.env`의 SITE_URL 등 설정 확인 |

### 1-4. 동기화가 필요한 경우

```bash
# Replit에서 덤프 (운영 전환용이므로 확인 프롬프트 없이)
bash scripts/db-export.sh
# → backups/replit-export-YYYY-MM-DD_HHMM.sql.gz

# VPS로 전송
scp backups/replit-export-YYYY-MM-DD_HHMM.sql.gz root@116.124.133.163:/tmp/

# VPS에서 복원 전 현재 Cafe24 DB 백업 (안전망)
cd /var/www/playgangneung
bash scripts/backup.sh
# → backups/YYYY-MM-DD.sql.gz (Cafe24 현재 상태 보존)

# Cafe24 DB에 Replit 데이터 덮어쓰기
source .env
gunzip -c /tmp/replit-export-YYYY-MM-DD_HHMM.sql.gz | psql "$DATABASE_URL"
```

**롤백**: 동기화 실패 시 위에서 백업한 `backups/YYYY-MM-DD.sql.gz`로 복원

```bash
gunzip -c backups/YYYY-MM-DD.sql.gz | psql "$DATABASE_URL"
```

---

## Phase 2. Cafe24 PM2 Cluster → Fork/1 정상화

### 현재 상태
```
PM2 exec_mode: cluster_mode, instances: 14
ecosystem.config.cjs: exec_mode: "fork", instances: 1  (불일치)
```

### 왜 정상화해야 하는가
- cluster 14개 → `startScheduler()` 14회 호출 (이론상)
- 크롤러가 동일 외부 사이트를 14번 방문 → IP 차단 위험
- `backup.sh`가 동시에 14번 실행 → 파일 race condition
- DB Keep-alive가 4분마다 14번 → 분당 3.5회 불필요한 쿼리

### 2-1. 전환 전 현재 상태 기록 (VPS)

```bash
# 현재 상태 스냅샷 저장
pm2 show playgangneung > /tmp/pm2-before-fork-migration.txt
pm2 list >> /tmp/pm2-before-fork-migration.txt
cat ~/.pm2/dump.pm2 >> /tmp/pm2-before-fork-migration.txt

echo "스냅샷 저장 완료: /tmp/pm2-before-fork-migration.txt"
```

### 2-2. 안전한 전환 절차 (무중단 불가, 짧은 중단 발생)

```bash
cd /var/www/playgangneung

# 1단계: Replit 저장소의 ecosystem.config.cjs 확인
cat ecosystem.config.cjs | grep -E "exec_mode|instances"
# → exec_mode: "fork", instances: 1 이어야 함

# 2단계: 현재 프로세스 중단 (약 2~5초 다운타임)
pm2 delete playgangneung

# 3단계: ecosystem.config.cjs 기준으로 재시작
pm2 start ecosystem.config.cjs
# → fork 모드, 1개 인스턴스

# 4단계: 정상 확인
pm2 status
pm2 show playgangneung | grep -E "exec mode|instances|status"
# → exec mode: fork, instances: 1, status: online

# 5단계: 헬스체크
sleep 3
curl -sf http://localhost:8080/api/healthz
# → {"status":"ok"}

# 6단계: 스케줄러 정상 등록 확인
pm2 logs playgangneung --lines 20 --nostream
# → "크롤링 스케줄 등록 완료" 1회만 보여야 함

# 7단계: dump.pm2 갱신 (재부팅 후에도 fork/1 복원되도록)
pm2 save
```

### 2-3. 실패 시 롤백

```bash
# 이전 cluster 상태로 되돌리기
pm2 delete playgangneung
pm2 start dist/index.mjs --name playgangneung -i 14 --exec-mode cluster
pm2 save
```

### 2-4. 검증

```bash
# 스케줄러 등록이 1회인지 확인 (fork 전환 후 약 1분 대기)
grep -c "크롤링 스케줄 등록 완료" /var/www/playgangneung/logs/pm2-out.log
# → fork 전환 이후 로그에서 1이 나오면 성공
```

---

## Phase 3. Cafe24 기능 검증

> **이 단계를 모두 통과해야 DNS 변경 가능**  
> VPS 직접 접근 기준으로 검증 (nginx를 통한 8080 프록시)

### 3-1. 관리자 로그인

```bash
# 세션 쿠키 받기
curl -s -c /tmp/cafe24-cookies.txt \
  -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"운영_비밀번호"}' \
  -w "\n상태코드: %{http_code}\n"
# → 200 + {"ok":true} 성공

# 세션 확인
curl -s -b /tmp/cafe24-cookies.txt \
  http://localhost:8080/api/auth/me \
  -w "\n상태코드: %{http_code}\n"
# → 200 + {"isAdmin":true} 성공
```

### 3-2. /api/feed 응답

```bash
curl -sf http://localhost:8080/api/feed | python3 -m json.tool | head -20
# → events 배열, 내용이 있어야 함 (빈 배열이면 DB 확인 필요)
```

### 3-3. /api/top5 응답

```bash
curl -sf http://localhost:8080/api/top5 | python3 -m json.tool
# → {"data":[...]} 형태 응답
```

### 3-4. 크롤링 수동 트리거

```bash
curl -s -b /tmp/cafe24-cookies.txt \
  -X POST http://localhost:8080/api/events/crawl \
  -w "\n상태코드: %{http_code}\n"
# → 200 응답 (크롤링 비동기 시작)

# 30초 후 결과 확인
sleep 30
pm2 logs playgangneung --lines 20 --nostream | grep "크롤링"
```

### 3-5. SSR 콘텐츠 확인 (OG 태그 포함)

```bash
# DB에서 이벤트 ID 하나 가져오기
source /var/www/playgangneung/.env
EVENT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM events WHERE status='approved' LIMIT 1;" | tr -d ' ')

curl -sf http://localhost:8080/content/$EVENT_ID | grep -o 'og:title.*'
# → og:title 메타태그 포함 응답
```

### 3-6. 카드이미지 서빙

```bash
ls /var/www/playgangneung/artifacts/api-server/public/cards/ | head -5
# → PNG 파일 목록 (있으면)

# 파일이 있으면 서빙 확인
CARD=$(ls /var/www/playgangneung/artifacts/api-server/public/cards/ | head -1)
curl -sI http://localhost:8080/api/cards/$CARD
# → 200 + content-type: image/png
```

### 검증 결과 기록

```
[ ] 3-1. 관리자 로그인 → HTTP 200 + {"ok":true}
[ ] 3-2. /api/feed → 이벤트 목록 JSON
[ ] 3-3. /api/top5 → TOP5 목록 JSON
[ ] 3-4. 크롤링 수동 트리거 → 정상 실행 로그
[ ] 3-5. SSR /content/:id → og:title 포함 HTML
[ ] 3-6. healthz → {"status":"ok"}
```

---

## Phase 4. nginx 설정 및 SSL 인증서

### 4-1. nginx 설정 확인

```bash
# 설정 파일 존재 확인
ls -la /etc/nginx/sites-enabled/playgangneung.conf

# 문법 검사
nginx -t
# → test is successful

# nginx 상태
systemctl status nginx | head -5
```

### 4-2. SSL 인증서 발급

> **전제**: DNS 변경 전이므로, 이 단계에서는 `--dry-run`만 실행하고 실제 발급은 DNS 변경 후에

```bash
# dry-run (실제 발급 없이 가능 여부만 확인)
# ← DNS가 아직 Replit을 가리키므로 실제 발급은 실패함 (정상)
certbot certonly --nginx \
  -d playgangneung.com \
  -d www.playgangneung.com \
  --dry-run \
  -m admin@playgangneung.com \
  --agree-tos \
  --non-interactive
# ← "Simulated renewal succeeded" 나오면 DNS 변경 후 실제 발급 가능
```

---

## Phase 5. DNS 변경 절차 (실제 전환)

> **이 단계는 사용자에게 영향을 줍니다. 아래 전제가 모두 충족된 후에만 실행합니다.**

### 전제 조건 (모두 ✅)

```
✅ Phase 1: Cafe24 DB 최신 상태 확인
✅ Phase 2: PM2 fork/1 정상화
✅ Phase 3: 6개 기능 검증 통과
✅ Phase 4: nginx 설정 완료, SSL dry-run 성공
✅ 현재 DNS TTL 낮추기 완료 (아래 5-1 참조)
✅ Replit 배포 앱 unpublish 하지 않은 상태 (롤백 경로 유지)
```

### 5-1. DNS 전환 전 TTL 낮추기 (최소 1시간 전)

도메인 등록기관(가비아, 후이즈 등)에서:

```
현재: playgangneung.com A레코드 → 34.111.179.208 (Replit)
                     TTL → 현재 값 확인 (보통 3600초 = 1시간)

변경: TTL → 300 (5분)으로 낮추기
     → 나중에 DNS 롤백 시 5분 내 되돌릴 수 있음
```

TTL 낮춘 후 최소 1시간 대기 (기존 TTL만큼 캐시 남아있음).

### 5-2. DNS A 레코드 변경

```
도메인 등록기관 DNS 관리 화면에서:

변경 전: playgangneung.com  A  34.111.179.208  TTL 300
         www.playgangneung.com  A  34.111.179.208  TTL 300

변경 후: playgangneung.com  A  116.124.133.163  TTL 300
         www.playgangneung.com  A  116.124.133.163  TTL 300
```

### 5-3. DNS 전파 확인

```bash
# Replit 터미널 또는 로컬에서 실행
# 전파까지 최대 TTL(300초 = 5분) 소요

watch -n 10 "dig playgangneung.com +short"
# → 116.124.133.163 이 나오면 전파 완료
```

### 5-4. SSL 인증서 실제 발급 (DNS 전파 확인 후)

```bash
# VPS에서 실행
certbot --nginx \
  -d playgangneung.com \
  -d www.playgangneung.com \
  -m admin@playgangneung.com \
  --agree-tos \
  --non-interactive

systemctl reload nginx
```

### 5-5. 전환 후 즉시 검증

```bash
# HTTPS 헬스체크
curl -sf https://playgangneung.com/api/healthz
# → {"status":"ok"}

# 프론트엔드
curl -sI https://playgangneung.com/
# → HTTP/2 200

# OG 태그 (소셜 공유 확인)
curl -sf https://playgangneung.com/content/1 | grep "og:title"

# SSL 인증서 확인
curl -vI https://playgangneung.com/ 2>&1 | grep "issuer\|expire"
# → issuer: Let's Encrypt 포함
```

---

## Phase 6. 롤백 방법

### 롤백 시나리오별 대응

#### 시나리오 A: DNS 변경 전 문제 발견 → 롤백 불필요

DNS를 아직 바꾸지 않은 상태이므로 사용자에게 영향 없음.  
Cafe24 설정만 수정 후 Phase 3 재검증.

#### 시나리오 B: DNS 변경 직후 문제 발견 (5분 이내)

```
도메인 등록기관에서:
playgangneung.com A → 34.111.179.208 (Replit)으로 즉시 복구

TTL이 300초이므로 5분 내 모든 사용자 Replit으로 복귀.
```

#### 시나리오 C: SSL 발급 실패

```bash
# nginx를 HTTP 전용으로 임시 운영
# nginx/playgangneung.conf 에서 443 블록 주석 처리
# → 80으로 임시 접근 허용 후 SSL 문제 해결
```

#### 시나리오 D: Cafe24 DB 문제 (데이터 손실 등)

```bash
# Phase 1에서 백업한 Cafe24 이전 상태로 복원
source /var/www/playgangneung/.env
gunzip -c backups/YYYY-MM-DD.sql.gz | psql "$DATABASE_URL"
pm2 restart playgangneung
```

#### 시나리오 E: PM2 재시작 실패

```bash
# 이전 cluster 상태로 복원 (Phase 2 롤백)
pm2 start /var/www/playgangneung/artifacts/api-server/dist/index.mjs \
  --name playgangneung -i 14 --exec-mode cluster
pm2 save
```

### 롤백 완료 확인

```bash
# Replit 배포 앱이 응답하는지 확인
dig playgangneung.com +short
# → 34.111.179.208 (Replit)

curl -sf https://playgangneung.com/api/healthz
# → {"status":"ok"} (Replit 앱)
```

---

## Phase 7. Replit 개발 전용 고정

> DNS 전환 완료 + 48시간 안정 운영 확인 후 진행

### 7-1. Replit 배포 앱 unpublish

Replit 대시보드 → Deploy → Unpublish  
또는 Replit CLI:
```
replit unpublish
```

이후 `34.111.179.208`은 응답을 중단합니다.

### 7-2. Replit 환경 개발 전용으로 고정

```bash
# Replit .env 에서 DATABASE_URL을 개발 DB로 유지
# → Replit PostgreSQL: 개발/테스트 전용
# → Cafe24 PostgreSQL: 운영 전용

# 두 환경이 같은 DB를 바라보지 않도록 분리 확인
```

### 7-3. 개발 워크플로 정립

```
개발 흐름:
  코드 수정 (Replit) → git push → Cafe24 VPS에서 git pull → vps-deploy.sh

# VPS 배포 명령
cd /var/www/playgangneung
git pull origin main
bash scripts/vps-deploy.sh
```

### 7-4. Replit 환경 역할 최종 정리

| 환경 | 역할 | DB |
|---|---|---|
| Replit (개발) | 코드 작성, 기능 개발, 로컬 테스트 | Replit PostgreSQL (개발 데이터) |
| Cafe24 VPS (운영) | 실제 서비스, 사용자 트래픽 처리 | Cafe24 PostgreSQL (운영 데이터) |

---

## 전체 체크리스트 요약

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 1. DB 동기화
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 1-1. Replit DB 레코드 수 확인
[ ] 1-2. Cafe24 DB 레코드 수 확인
[ ] 1-3. 차이 있으면 동기화 (Cafe24 백업 후 덮어쓰기)
[ ] 1-4. 동기화 후 Cafe24 DB 레코드 수 재확인

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 2. PM2 정상화
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 2-1. 현재 상태 스냅샷 저장
[ ] 2-2. pm2 delete → pm2 start ecosystem.config.cjs
[ ] 2-3. exec_mode: fork, instances: 1 확인
[ ] 2-4. healthz 200 확인
[ ] 2-5. 스케줄러 등록 1회 확인
[ ] 2-6. pm2 save

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 3. 기능 검증
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 3-1. 관리자 로그인
[ ] 3-2. /api/feed 응답
[ ] 3-3. /api/top5 응답
[ ] 3-4. 크롤링 수동 트리거
[ ] 3-5. SSR /content/:id OG 태그
[ ] 3-6. healthz 200

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 4. nginx + SSL 준비
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 4-1. nginx -t 성공
[ ] 4-2. certbot dry-run 성공

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 5. DNS 전환
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 5-1. TTL → 300으로 낮추기 (1시간 전)
[ ] 5-2. DNS A 레코드 → 116.124.133.163
[ ] 5-3. dig 전파 확인
[ ] 5-4. certbot SSL 실제 발급
[ ] 5-5. https://playgangneung.com/api/healthz 200

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 6. 안정화 (48시간 모니터링)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 6-1. 다음 날 09:00 KST 크롤링 로그 1회 확인
[ ] 6-2. pm2 status online 유지 확인
[ ] 6-3. nginx error.log 이상 없음
[ ] 6-4. certbot 자동 갱신 dry-run 성공

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 7. Replit 개발 전용 고정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] 7-1. Replit 배포 앱 unpublish
[ ] 7-2. 개발 워크플로 문서화 (git pull → vps-deploy.sh)
[ ] 7-3. DNS TTL → 3600으로 복구 (안정화 후)
```

---

## 위험도 평가

| 단계 | 위험도 | 영향 범위 | 롤백 소요 시간 |
|---|---|---|---|
| Phase 1. DB 동기화 | 🟡 중간 | Cafe24 DB | 즉시 (백업 복원) |
| Phase 2. PM2 정상화 | 🟡 중간 | Cafe24 API (2~5초 중단) | 즉시 |
| Phase 3. 기능 검증 | 🟢 낮음 | 없음 (localhost만 테스트) | 해당 없음 |
| Phase 4. nginx+SSL | 🟢 낮음 | 없음 (DNS 미변경) | 해당 없음 |
| **Phase 5. DNS 변경** | 🔴 높음 | 전체 사용자 | TTL 300초 = 5분 |
| Phase 7. Replit unpublish | 🟡 중간 | Replit 롤백 불가 | Replit 재배포 필요 |

**Phase 5(DNS 변경)만이 사용자에게 직접 영향을 주는 유일한 단계입니다.**  
Phase 1~4를 완벽히 통과한 후에 실행하세요.

---

*작성일: 2026-06-04*  
*참조: docs/cafe24-vps-deployment-runbook.md, ecosystem.config.cjs*
