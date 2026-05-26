#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PLAY강릉 — Cafe24 VPS 최초 서버 세팅 스크립트
# Ubuntu 22.04 LTS 기준
#
# 사용법 (root 또는 sudo):
#   chmod +x scripts/vps-first-setup.sh
#   sudo ./scripts/vps-first-setup.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PLAY강릉 VPS 최초 환경 설정"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 시스템 업데이트 ───────────────────────────────────────
echo "▶ 시스템 패키지 업데이트..."
apt-get update -y && apt-get upgrade -y

# ── Node.js 24 설치 (NodeSource 공식 스크립트) ───────────
echo "▶ Node.js 24 설치..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
echo "  Node.js: $(node -v)"
echo "  npm:     $(npm -v)"

# ── pnpm 설치 ─────────────────────────────────────────────
echo "▶ pnpm 설치..."
npm install -g pnpm@latest
echo "  pnpm: $(pnpm -v)"

# ── PM2 설치 ──────────────────────────────────────────────
echo "▶ PM2 설치..."
npm install -g pm2
echo "  PM2: $(pm2 -v)"

# ── Nginx 설치 ────────────────────────────────────────────
echo "▶ Nginx 설치..."
apt-get install -y nginx
systemctl enable nginx
sudo systemctl start nginx

# ── Certbot (Let's Encrypt SSL) 설치 ─────────────────────
echo "▶ Certbot 설치..."
apt-get install -y certbot python3-certbot-nginx

# ── PostgreSQL 설치 (선택: 외부 DB 사용 시 불필요) ────────
echo "▶ PostgreSQL 설치..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# ── 로그 디렉토리 ─────────────────────────────────────────
mkdir -p /var/log/nginx
mkdir -p /var/www/playgangneung/logs

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  기본 환경 설정 완료!"
echo ""
echo "  다음 단계:"
echo "  1. git clone <repo> /var/www/playgangneung"
echo "  2. cd /var/www/playgangneung"
echo "  3. cp .env.example .env && vi .env   (환경변수 입력)"
echo "  4. ./scripts/vps-deploy.sh           (빌드 및 시작)"
echo "  5. Nginx 설정:"
echo "     cp nginx/playgangneung.conf /etc/nginx/sites-available/"
echo "     ln -s /etc/nginx/sites-available/playgangneung.conf \\"
echo "            /etc/nginx/sites-enabled/"
echo "     nginx -t && systemctl reload nginx"
echo "  6. SSL 인증서:"
echo "     certbot --nginx -d playgangneung.com -d www.playgangneung.com"
echo "  7. PM2 부팅 자동 시작:"
echo "     pm2 startup && pm2 save"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
