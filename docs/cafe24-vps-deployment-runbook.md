# PLAY강릉 — Cafe24 VPS 배포 절차서

> **목적**: Replit 워크플로와 완전히 분리된 독립 운영 환경 구축  
> **대상 서버**: Cafe24 VPS, Ubuntu 22.04 LTS  
> **최종 구성**: nginx(80/443) → PM2(8080) → PostgreSQL(5432)

---

## 사전 준비 (Replit에서)

### 1. DB 덤프 생성

```bash
# Replit 터미널에서 실행
bash scripts/db-export.sh
# → backups/replit-export-YYYY-MM-DD_HHMM.sql.gz 생성
```

### 2. 덤프 파일 VPS로 전송

```bash
scp backups/replit-export-YYYY-MM-DD_HHMM.sql.gz root@<VPS_IP>:/tmp/
```

---

## Phase 1. VPS 최초 세팅

> **한 번만 실행** — 서버 재설치 시에만 다시 실행

```bash
# SSH 접속
ssh root@<VPS_IP>

# 저장소 클론
git clone <YOUR_REPO_URL> /var/www/playgangneung
cd /var/www/playgangneung

# 최초 환경 세팅 (Node.js 24, pnpm, PM2, nginx, PostgreSQL, certbot)
chmod +x scripts/vps-first-setup.sh
sudo bash scripts/vps-first-setup.sh
```

**설치 확인:**

```bash
node -v          # v24.x.x
pnpm -v          # 9.x.x 이상
pm2 -v           # 5.x.x 이상
nginx -v         # nginx/1.x.x
psql --version   # psql 14.x 이상
```

**실패 시 확인:**

| 증상 | 원인 | 해결 |
|---|---|---|
| `node: command not found` | NodeSource 스크립트 실패 | `curl -fsSL https://deb.nodesource.com/setup_24.x \| bash - && apt-get install -y nodejs` |
| `nginx: command not found` | nginx 설치 실패 | `apt-get install -y nginx` |
| `psql: command not found` | PostgreSQL 설치 실패 | `apt-get install -y postgresql postgresql-contrib` |

---

## Phase 2. PostgreSQL DB 생성

```bash
# postgres 유저로 접속
sudo -u postgres psql

-- psql 프롬프트에서 실행
CREATE USER playgangneung WITH PASSWORD '강력한_비밀번호_입력';
CREATE DATABASE playgangneung_db OWNER playgangneung;
GRANT ALL PRIVILEGES ON DATABASE playgangneung_db TO playgangneung;
\q
```

**연결 테스트:**

```bash
psql postgresql://playgangneung:비밀번호@localhost:5432/playgangneung_db -c '\conninfo'
# → 연결 정보 출력 시 성공
```

**실패 시 로그:**

```bash
# PostgreSQL 로그
tail -50 /var/log/postgresql/postgresql-14-main.log
# 또는
journalctl -u postgresql --no-pager -n 50
```

---

## Phase 3. 환경변수 파일 작성

### API 서버 환경변수

```bash
cd /var/www/playgangneung

cp .env.example .env
nano .env   # 또는 vi .env
```

**반드시 변경해야 할 항목:**

```bash
NODE_ENV=production
PORT=8080

# 위 Phase 2에서 생성한 DB 연결 정보로 교체
DATABASE_URL=postgresql://playgangneung:강력한_비밀번호@localhost:5432/playgangneung_db

# 실제 도메인으로 교체
SITE_URL=https://playgangneung.com

# 32자 이상 무작위 문자열 (openssl rand -base64 32 로 생성)
SESSION_SECRET=

# Clerk 실제 키 (pk_live_..., sk_live_...)
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Meta API 실제 값
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
META_PAGE_ID=
META_APP_SECRET=

# 네이버/유튜브 API
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
YOUTUBE_API_KEY=
```

### 프론트엔드 빌드용 환경변수

```bash
cp artifacts/playgangneung-dashboard/.env.production.example \
   artifacts/playgangneung-dashboard/.env.production

nano artifacts/playgangneung-dashboard/.env.production
```

**변경 항목:**

```bash
# Clerk 공개 키 (pk_live_... — API 서버와 동일한 키)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# VPS에서는 Clerk 직접 연결 → 비워두기
VITE_CLERK_PROXY_URL=

# 결제 사용 시
VITE_ENABLE_TOSS_PAYMENT=false
VITE_TOSS_CLIENT_KEY=live_ck_...
```

---

## Phase 4. DB 복원

```bash
# /tmp 에 덤프 파일이 있는지 확인
ls -lh /tmp/replit-export-*.sql.gz

# 복원 (DATABASE_URL은 .env 기준)
source .env
gunzip -c /tmp/replit-export-YYYY-MM-DD_HHMM.sql.gz | psql "$DATABASE_URL"
```

**복원 확인:**

```bash
psql "$DATABASE_URL" -c "\dt"
# → events, ad_pools, ads, ... 테이블 목록 출력 시 성공
```

**실패 시 확인:**

```bash
# 오류 메시지 확인
gunzip -c /tmp/replit-export-*.sql.gz | psql "$DATABASE_URL" 2>&1 | head -30

# 대표 오류별 해결
# "role does not exist" → DB 사용자가 .env의 DATABASE_URL과 다름
# "database does not exist" → Phase 2 DB 생성 다시 확인
# "permission denied" → GRANT 명령 재실행
```

---

## Phase 5. 앱 빌드 및 배포

```bash
cd /var/www/playgangneung

chmod +x scripts/vps-deploy.sh
bash scripts/vps-deploy.sh
```

**vps-deploy.sh 내부 단계 (자동 실행):**

```
[1/5] 의존성 설치    (pnpm install --frozen-lockfile)
[2/5] DB 마이그레이션 (drizzle-kit migrate — 안전, push 아님)
[3/5] API 서버 빌드  (node ./build.mjs → dist/index.mjs)
[4/5] 프론트엔드 빌드 (vite build → dist/public/)
[5/5] PM2 시작       (ecosystem.config.cjs)
```

**실패 시 확인:**

```bash
# 의존성 설치 실패
cat /root/.local/share/pnpm/store/v3/tmp/dlx-*/stderr

# 빌드 실패
pnpm --filter @workspace/api-server run build 2>&1 | tail -30

# PM2 시작 실패
pm2 logs playgangneung --lines 50
```

---

## Phase 6. PM2 확인

```bash
# 프로세스 상태
pm2 status
# → playgangneung | online | 0 restarts

# 실시간 로그
pm2 logs playgangneung

# 최근 에러
pm2 logs playgangneung --err --lines 50
```

**부팅 자동시작 등록:**

```bash
pm2 startup
# → 출력된 명령어를 복사해서 그대로 실행 (sudo env PATH=... pm2 startup ...)

pm2 save
# → 현재 프로세스 목록 저장
```

**로그 파일 위치:**

```
/var/www/playgangneung/logs/pm2-out.log   # 표준 출력
/var/www/playgangneung/logs/pm2-err.log   # 에러 출력
```

**헬스체크 (PM2 직접):**

```bash
curl -sf http://localhost:8080/api/healthz
# → {"status":"ok"} 또는 {"ok":true} 응답 시 성공
```

---

## Phase 7. nginx 설정 및 확인

```bash
# nginx 설정 파일 복사
cp nginx/playgangneung.conf /etc/nginx/sites-available/playgangneung.conf

# 심볼릭 링크 생성
ln -s /etc/nginx/sites-available/playgangneung.conf \
      /etc/nginx/sites-enabled/playgangneung.conf

# 기본 설정 비활성화 (80 포트 충돌 방지)
rm -f /etc/nginx/sites-enabled/default

# 설정 문법 검사
nginx -t
# → nginx: configuration file /etc/nginx/nginx.conf test is successful

# nginx 재로드
systemctl reload nginx
```

**확인:**

```bash
# nginx 상태
systemctl status nginx

# 80 포트 응답 (아직 HTTP)
curl -I http://playgangneung.com/api/healthz
# → HTTP/1.1 301 (SSL 적용 전) 또는 200 (SSL 적용 후)
```

**에러 로그:**

```bash
# nginx 에러 로그
tail -50 /var/log/nginx/playgangneung_error.log

# nginx 액세스 로그
tail -20 /var/log/nginx/playgangneung_access.log

# nginx 전체 상태
journalctl -u nginx --no-pager -n 30
```

---

## Phase 8. SSL 인증서 발급 (Let's Encrypt)

> **전제**: DNS A 레코드가 이미 VPS IP를 가리키고 있어야 함

```bash
# SSL 인증서 발급 (nginx 자동 설정 포함)
certbot --nginx \
  -d playgangneung.com \
  -d www.playgangneung.com \
  --non-interactive \
  --agree-tos \
  -m admin@playgangneung.com

# 발급 후 nginx 재로드
systemctl reload nginx
```

**자동 갱신 확인:**

```bash
# 갱신 dry-run 테스트
certbot renew --dry-run
# → Congratulations, all simulated renewals succeeded

# cron 등록 확인 (certbot 설치 시 자동 등록됨)
systemctl status certbot.timer
```

**실패 시 확인:**

```bash
# DNS 전파 확인
dig playgangneung.com +short
# → VPS IP가 출력돼야 함

# 80 포트 방화벽 확인
ufw status
# → 80, 443, 22 허용 상태인지 확인

# certbot 로그
tail -50 /var/log/letsencrypt/letsencrypt.log
```

---

## Phase 9. 최종 Health Check

```bash
# HTTPS 헬스체크
curl -sf https://playgangneung.com/api/healthz
# → {"status":"ok"} 성공

# 공개 피드 응답 확인
curl -sf https://playgangneung.com/api/feed | python3 -m json.tool | head -20
# → JSON 배열 출력 성공

# 프론트엔드 응답 확인
curl -sI https://playgangneung.com/
# → HTTP/2 200 성공

# SSL 인증서 유효성
curl -vI https://playgangneung.com/ 2>&1 | grep "SSL certificate\|expire\|issuer"
```

---

## 로그 위치 한눈에 보기

| 구분 | 로그 위치 | 확인 명령 |
|---|---|---|
| **앱 표준 출력** | `/var/www/playgangneung/logs/pm2-out.log` | `pm2 logs playgangneung` |
| **앱 에러** | `/var/www/playgangneung/logs/pm2-err.log` | `pm2 logs playgangneung --err` |
| **nginx 액세스** | `/var/log/nginx/playgangneung_access.log` | `tail -f /var/log/nginx/playgangneung_access.log` |
| **nginx 에러** | `/var/log/nginx/playgangneung_error.log` | `tail -f /var/log/nginx/playgangneung_error.log` |
| **PostgreSQL** | `/var/log/postgresql/postgresql-14-main.log` | `tail -50 /var/log/postgresql/postgresql-14-main.log` |
| **certbot** | `/var/log/letsencrypt/letsencrypt.log` | `tail -50 /var/log/letsencrypt/letsencrypt.log` |
| **시스템 전체** | systemd journal | `journalctl -u nginx -u postgresql --no-pager -n 50` |

---

## Replit 완전 분리 검증 체크리스트

> 아래 항목을 순서대로 확인합니다.  
> **모두 통과해야** Replit에서 독립된 것으로 간주합니다.

### 준비

```bash
# Replit에서: 모든 워크플로 중단
# (Replit IDE 닫기 / Stop 버튼)
# → API 서버 워크플로, 프론트엔드 워크플로 모두 중단
```

### 검증 항목

| # | 검증 항목 | 명령 / 방법 | 성공 기준 |
|---|---|---|---|
| 1 | **Replit 워크플로 중단** | Replit IDE에서 워크플로 Stop | Replit 미리보기 화면에서 앱 응답 없음 |
| 2 | **도메인 접속** | 브라우저에서 `https://playgangneung.com` | 홈페이지 정상 로딩 |
| 3 | **API 헬스체크** | `curl https://playgangneung.com/api/healthz` | `{"status":"ok"}` 응답 |
| 4 | **공개 피드** | `curl https://playgangneung.com/api/feed` | 이벤트 JSON 배열 응답 |
| 5 | **크롤링 스케줄** | `pm2 logs playgangneung \| grep 크롤링` | 매일 09:00 KST 실행 로그 확인 (또는 수동 트리거) |
| 6 | **관리자 로그인** | `https://playgangneung.com/login` 접속 후 로그인 | 관리자 대시보드 정상 진입 |
| 7 | **TOP5 조회** | `curl https://playgangneung.com/api/top5` | `{"data":[...]}` 응답 |
| 8 | **콘텐츠 SSR** | `curl -I https://playgangneung.com/content/1` | `200 OK` + OG 태그 포함 |
| 9 | **PM2 자동재시작** | `pm2 restart playgangneung` 후 `pm2 status` | 재시작 후 `online` 상태 |
| 10 | **서버 재부팅 후** | `sudo reboot` → SSH 재접속 → `pm2 status` | 재부팅 후 자동으로 `online` 상태 |

### 크롤링 스케줄 즉시 확인 (수동 트리거)

```bash
# PM2를 통해 API 서버 수동 크롤링 트리거
curl -X POST https://playgangneung.com/api/events/crawl \
  -H "Cookie: <관리자 세션 쿠키>" \
  -w "\n상태코드: %{http_code}\n"
# → 200 응답 시 크롤링 정상 실행
```

### 검증 완료 기준

```
☐ 1. Replit 워크플로 중단 상태에서 playgangneung.com 정상 접속
☐ 2. /api/healthz 200 응답
☐ 3. /api/feed JSON 정상 응답
☐ 4. 관리자 로그인 성공
☐ 5. TOP5 조회 성공
☐ 6. 서버 재부팅 후 PM2 자동 복구 확인

→ 6개 모두 통과 = Replit 완전 분리 성공
```

---

## 이후 단계 (별도 진행)

```
☐ Phase 10. API 서버 + scheduler-worker 분리
            (Cafe24 단독 실행 검증 완료 후)
            → ecosystem.config.cjs 주석 블록 참조

☐ Phase 11. Replit을 개발 전용 환경으로 고정
            - Replit DB는 개발 DB로 유지
            - VPS DB는 운영 DB로 유지
            - GitHub을 통한 코드 동기화
```

---

*작성일: 2026-06-04 | 기준 파일: ecosystem.config.cjs, vps-deploy.sh, vps-first-setup.sh, nginx/playgangneung.conf, .env.example*
