/**
 * PM2 Ecosystem 설정 — PLAY강릉 VPS 운영
 *
 * 사용법:
 *   pm2 start ecosystem.config.cjs            # 최초 시작
 *   pm2 reload ecosystem.config.cjs --update-env  # 무중단 재시작
 *   pm2 save && pm2 startup                   # 부팅 자동시작 등록
 *   pm2 logs playgangneung                    # 실시간 로그
 *   pm2 status                                # 상태 확인
 */
"use strict";

// ── 공통 환경변수 ─────────────────────────────────────────────────────────────
// .env 파일은 vps-deploy.sh 에서 source 후 pm2 start — 여기서 직접 읽지 않음
const BASE_ENV = {
  NODE_ENV : "production",
  PORT     : "8080",
};

module.exports = {
  apps: [
    // ──────────────────────────────────────────────────────────────────────────
    // [현재] API 서버 단일 프로세스
    //   - Express API + node-cron 내장 스케줄러(크롤링/Meta수집/백업) 통합 실행
    //   - exec_mode: "fork" 필수 — cluster 모드 사용 시 node-cron이 인스턴스마다
    //     실행되어 크롤링/Meta성과수집이 N배 중복 실행됨
    //
    // [추후 분리 계획] worker 분리 시 아래 apps 배열에 추가:
    //   {
    //     name  : "playgangneung-scheduler",
    //     script: "./artifacts/api-server/dist/scheduler-worker.mjs",
    //     ...
    //   }
    //   → API 서버에서 node-cron 제거 후 별도 프로세스로 분리
    //   → API 서버는 cluster 2인스턴스, scheduler는 fork 1인스턴스로 운영 가능
    // ──────────────────────────────────────────────────────────────────────────
    {
      name       : "playgangneung",
      script     : "./artifacts/api-server/dist/index.mjs",
      node_args  : "--enable-source-maps",
      cwd        : "/var/www/playgangneung",

      exec_mode  : "fork",   // ← cluster 절대 사용 금지 (node-cron 중복 실행)
      instances  : 1,

      env        : BASE_ENV,

      // ── 재시작 정책 ──────────────────────────────────────────
      autorestart       : true,
      watch             : false,
      max_memory_restart: "512M",
      restart_delay     : 3000,   // crash 후 3초 대기 후 재시작
      max_restarts      : 10,     // 10회 이상 연속 crash 시 중단 (운영자 확인)
      min_uptime        : "10s",  // 10초 이상 유지돼야 정상 시작으로 판단

      // ── 로그 ─────────────────────────────────────────────────
      out_file       : "./logs/pm2-out.log",
      error_file     : "./logs/pm2-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs     : true,
    },

    // ── [예약] 스케줄러 워커 (현재 주석 처리) ─────────────────────────────────
    // API 서버와 스케줄러를 분리하려면 아래 블록 활성화 후:
    // 1. artifacts/api-server/src/index.ts 에서 startScheduler() 호출 제거
    // 2. artifacts/api-server/src/scheduler-worker.ts 생성 (startScheduler만 호출)
    // 3. build.mjs 에 scheduler-worker.ts 엔트리 추가
    //
    // {
    //   name       : "playgangneung-scheduler",
    //   script     : "./artifacts/api-server/dist/scheduler-worker.mjs",
    //   node_args  : "--enable-source-maps",
    //   cwd        : "/var/www/playgangneung",
    //   exec_mode  : "fork",
    //   instances  : 1,
    //   env        : BASE_ENV,
    //   autorestart: true,
    //   watch      : false,
    //   out_file   : "./logs/scheduler-out.log",
    //   error_file : "./logs/scheduler-err.log",
    //   log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    // },
  ],
};
