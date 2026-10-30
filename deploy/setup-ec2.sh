#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu EC2 instance. Run it on the instance:
#   bash setup-ec2.sh            (domain defaults to <public-ip>.sslip.io)
#   DOMAIN=routes.example.com bash setup-ec2.sh
# Safe to run again: it never overwrites an existing .env.
set -euo pipefail

APP_DIR=/opt/weatherroute

echo "==> Docker (Ubuntu's own packages, which also cover brand-new releases)"
if ! command -v docker >/dev/null; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2
  sudo systemctl enable --now docker
fi
sudo usermod -aG docker "$USER"

echo "==> Swap (1 GB instances run out of memory without it)"
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> App directory"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

if [ -z "${DOMAIN:-}" ]; then
  token=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
  ip=$(curl -fsS -H "X-aws-ec2-metadata-token: $token" \
    http://169.254.169.254/latest/meta-data/public-ipv4)
  DOMAIN="$ip.sslip.io"
fi

if [ ! -f "$APP_DIR/.env" ]; then
  echo "==> Writing $APP_DIR/.env for $DOMAIN"
  secret=$(openssl rand -base64 48 | tr -d '\n/+=')
  # 127.0.0.1 and localhost stay allowed for the container's own health check.
  cat > "$APP_DIR/.env" <<ENV
DOMAIN=$DOMAIN
DJANGO_SECRET_KEY=$secret
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=$DOMAIN,localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=https://$DOMAIN
HERE_API_KEY=
ENV
  chmod 600 "$APP_DIR/.env"
else
  echo "==> $APP_DIR/.env already exists; left unchanged"
fi

echo
echo "Done. The site will be served at: https://$(grep '^DOMAIN=' "$APP_DIR/.env" | cut -d= -f2)"
echo "Log out and back in once so your user can run docker without sudo."
