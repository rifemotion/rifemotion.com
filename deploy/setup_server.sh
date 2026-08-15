#!/bin/bash
set -e

# ==========================================
# RifeMotion Automated Server Setup Script
# Ubuntu 22.04 / 24.04 LTS
# ==========================================

echo "==> 1. Updating packages and installing prerequisites..."
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl ufw

echo "==> 2. Setting up project directory at /var/www/rifemotion..."
mkdir -p /var/www/rifemotion
cd /var/www/rifemotion

echo "==> 3. Creating Python virtual environment..."
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

echo "==> 4. Generating default .env if missing..."
if [ ! -f .env ]; then
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    cat <<EOF > .env
SECRET_KEY=$SECRET_KEY
DATABASE_URL=sqlite:////var/www/rifemotion/data/rifemotion.db
HOST=127.0.0.1
PORT=8000
EOF
    echo "[+] .env generated with random SECRET_KEY"
fi

mkdir -p data

echo "==> 5. Setting up Systemd Service..."
cp deploy/rifemotion.service /etc/systemd/system/rifemotion.service
systemctl daemon-reload
systemctl enable rifemotion
systemctl restart rifemotion

echo "==> 6. Setting up Nginx..."
cp deploy/nginx.conf /etc/nginx/sites-available/rifemotion.conf
ln -sf /etc/nginx/sites-available/rifemotion.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> 7. Configuring Firewall (UFW)..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==============================================================="
echo "✅ Базовая установка завершена!"
echo ""
echo "Следующие шаги:"
echo "1. Создайте первого администратора командой:"
echo "   /var/www/rifemotion/venv/bin/python create_admin.py"
echo ""
echo "2. Получите бесплатный SSL-сертификат HTTPS командой:"
echo "   certbot --nginx -d rifemotion.com -d www.rifemotion.com"
echo "==============================================================="
