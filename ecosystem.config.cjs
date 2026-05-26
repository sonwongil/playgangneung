/**
 * PM2 Ecosystem 설정 — Cafe24 VPS 배포용
 *
 * 사용법:
 *   pm2 start ecosystem.config.cjs          # 처음 시작
 *   pm2 reload ecosystem.config.cjs         # 무중단 재시작
 *   pm2 save && pm2 startup                 # 서버 재부팅 시 자동 시작 등록
 */

module.exports = {
  apps: [
    {
      name: "playgangneung",
      script: "./artifacts/api-server/dist/index.mjs",
      node_args: "--enable-source-maps",
      cwd: "/var/www/playgangneung",   // ← VPS 실제 경로로 변경
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_file: ".env",
      env: {
        NODE_ENV: "production",
        PORT: "8080",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
