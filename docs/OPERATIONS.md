# PLAY강릉 운영 문서 (OPERATIONS)

> 이 문서는 Cafe24 VPS 독립 운영 기준으로 관리됩니다.  
> nginx / DNS / SSL / PM2 설정 변경은 이 문서에 기록합니다.  
> 백업 파일(.tar.gz, .sql) 자체는 GitHub에 올리지 않습니다.

---

## 운영 구조 요약

| 역할 | 위치 |
|---|---|
| 코드 수정·검증 | Replit 워크스페이스 |
| 공식 코드 기준 | GitHub `main` 브랜치 |
| 실제 운영 서버 | Cafe24 VPS `/var/www/playgangneung` |
| 도메인 | `playgangneung.com` → `116.124.133.163` |
| PM2 프로세스 | `playgangneung` (fork mode, instances=1) |
| DB | VPS 로컬 PostgreSQL (`localhost / playgangneung` DB) |
| 인증 | 독립 Clerk Production (clerk.com) |

---

## PLAY강릉 독립 운영 전환 기준 백업

### 백업 위치

```
/var/www/playgangneung/backups/
```

### 확인된 백업 파일

| 종류 | 파일명 |
|---|---|
| 코드/파일 백업 | `stable-independent-operation-20260612-143955.tar.gz` |
| DB 백업 | `playgangneung-db-independent-operation-20260612-144212.sql` |

### 백업 의미

이 백업은 **Replit 관리형 운영에서 Cafe24 VPS 독립 운영으로 전환 완료된 기준점**입니다.

전환 완료 시점의 확인된 상태:

- `playgangneung.com` DNS A 레코드 → VPS IP `116.124.133.163` 정상
- VPS `DATABASE_URL` → `localhost / playgangneung` DB 사용 (Replit DB 미사용)
- VPS `.env`에 Replit Object Storage / Bucket 설정 없음 → 로컬 파일시스템 사용
- Replit DB 및 Replit Object Storage 운영에 미사용
- 독립 Clerk Production 이메일 로그인 정상
- Google OAuth 로그인 정상
- Clerk DNS Verified / SSL Issued 완료
- 홈 피드 콘텐츠 185개 승인 후 프론트 정상 반영 확인

### 백업 확인 명령

```bash
cd /var/www/playgangneung
ls -lh backups/
```

### 복구 주의사항

- **DB 복구 전 반드시 현재 DB 백업 먼저 수행** — 복구는 덮어쓰기
- DB 복구 시 PM2 프로세스 중지 후 진행 (`pm2 stop playgangneung`)
- 코드 복구 후 반드시 빌드 재실행 (`pnpm run build`) 후 PM2 재시작
- nginx 설정은 이 백업에 포함되지 않음 — `/etc/nginx/` 별도 관리
- SSL 인증서는 certbot 자동 갱신 — 복구 대상 아님
- 복구 후 `playgangneung.com` 실제 접속 및 로그인 정상 여부 반드시 확인

---

## 정기 백업 스케줄

API 서버 내 `node-cron` 스케줄러가 매일 04:00(KST) DB 백업을 자동 실행합니다.

```
scheduler.ts — backupTask: cron.schedule("0 4 * * *", runBackup, { timezone: "Asia/Seoul" })
백업 저장 위치: VPS /var/www/playgangneung/backups/
```

---

## 배포 후 상태 확인 체크리스트

```bash
# 1. PM2 상태
pm2 status

# 2. 프로세스 로그 (최근 50줄)
pm2 logs playgangneung --lines 50

# 3. API 서버 응답 확인
curl -s https://playgangneung.com/api/feed | python3 -m json.tool | head -20

# 4. 로그인 페이지 접근 확인
curl -s -o /dev/null -w "%{http_code}" https://playgangneung.com/

# 5. DB 연결 확인
psql -U postgres -d playgangneung -c "SELECT COUNT(*) FROM events;"
```

---

## 절대 금지 사항 (운영 원칙)

- `git push --force` / `git push -f` — 어떤 상황에서도 금지
- PM2 cluster mode 또는 instances 수 변경 금지
- `ecosystem.config.cjs`의 `exec_mode: fork`, `instances: 1` 변경 금지
- nginx / DNS / SSL / certbot 설정 임의 변경 금지
- 운영 DB 직접 수정 금지 (SELECT 조회만 허용)
- 홈 피드 구조 / TOP5 캐러셀 / `/content/:id` 구조 임의 변경 금지
