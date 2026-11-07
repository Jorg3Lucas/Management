#!/usr/bin/env bash
# setup-vps.sh
# Roteiro para subir o MIR4 Ranking Ops na VPS Ubuntu 22.04.
#
# Como usar:
#   1. Edite os valores do bloco CONFIGURAÇÃO abaixo antes de rodar.
#   2. Confirme que o repositório já está clonado e atualizado em APP_DIR.
#   3. Copie para a VPS e execute lá como usuário normal (yudengs).
#
# ATENÇÃO:
#   - Esse arquivo foi feito para rodar na VPS, não na máquina local.
#   - Ele roda como o usuário atual, mas alguns passos pedem
#     sudo para instalar pacotes do sistema e escrever em /etc/nginx.
#   - Se algo falhar, rode os passos manualmente e veja o erro antes de
#     tentar de novo.
#
# Esse é o script de origem local. Para usar na VPS, copie:
#   scp setup-vps.sh yudengs@23.94.95.198:/home/yudengs/management/
# e então rode na VPS:
#   cd ~/management
#   chmod +x setup-vps.sh
#   ./setup-vps.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO - edite antes de rodar
# ---------------------------------------------------------------------------

DOMAIN="resistancemir4.online"
VPS_IP="23.94.95.198"
ADMIN_PASSWORD="admin123"
SYNC_TOKEN="um_token_secreto_aqui"
EMAIL_FOR_LETSENCRYPT="jorgelucas.sd@gmail.com"

# Caminho do repositório na VPS. Ajuste se você clonou em outro lugar.
APP_DIR="/home/yudengs/management"

DATABASE_PATH="$APP_DIR/data/mir4.db"

PORT=3000
NODE_VERSION=20

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log() { printf '\n===== %s =====\n' "$*"; }

die() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

confirm() {
  printf 'Continuar? (s/n) '
  read -r resp
  case "$resp" in
    s|S|sim|yes|y) return 0 ;;
    *) printf 'Abortado.\n' ; exit 0 ;;
  esac
}

# ---------------------------------------------------------------------------
# 0. Sanidade inicial
# ---------------------------------------------------------------------------

log "0. Checando ambiente inicial"

if [[ ! -d "$APP_DIR" ]]; then
  die "Não encontrei $APP_DIR. Clone o repositório e rode de novo."
fi

cd "$APP_DIR"

printf 'Usuário: %s\n' "$USER"
printf 'Diretório do app: %s\n' "$APP_DIR"
printf 'Domínio: %s\n' "$DOMAIN"
printf 'IP da VPS: %s\n' "$VPS_IP"
command -v node >/dev/null 2>&1 && printf 'Node atual: %s\n' "$(node -v)" || true
printf '\n'

# ---------------------------------------------------------------------------
# 1. Atualizar Sistema
# ---------------------------------------------------------------------------

log "1. Atualizando pacotes do sistema"

sudo apt-get update -y
sudo apt-get upgrade -y

# NodeSource Node 20 para Ubuntu 22.04.
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v"$NODE_VERSION."* ]]; then
  log "Instalando Node.js $NODE_VERSION via NodeSource"

  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x |
    sudo -E bash -
  sudo apt-get install -y nodejs
else
  printf 'Node.js %s já instalado. Pulando instalação.\n' "$NODE_VERSION"
fi

node -v
npm -v

# ---------------------------------------------------------------------------
# 2. Pré-requisitos do sistema
# ---------------------------------------------------------------------------

log "2. Instalando dependências do sistema"

sudo apt-get install -y git build-essential nginx

if ! command -v certbot >/dev/null 2>&1; then
  sudo apt-get install -y certbot python3-certbot-nginx
fi

# ---------------------------------------------------------------------------
# 3. Preparar app
# ---------------------------------------------------------------------------

log "3. Preparando diretório do app"

mkdir -p "$(dirname "$DATABASE_PATH")"
chmod 700 "$(dirname "$DATABASE_PATH")"

# ---------------------------------------------------------------------------
# 4. Configuração do Next.js para produção standalone
# ---------------------------------------------------------------------------

log "4. Criando configuração do Next.js para produção standalone"

if [[ ! -f "$APP_DIR/next.config.mjs" ]] && [[ ! -f "$APP_DIR/next.config.js" ]]; then
  cat > "$APP_DIR/next.config.mjs" <<'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // SQLite em arquivo precisa das dependências nativas intactas no runtime.
    serverComponentsExternalPackages: ['better-sqlite3', '@vscode/sqlite3'],
  },
};

export default nextConfig;
EOF
  printf 'Criado: %s\n' "$APP_DIR/next.config.mjs"
else
  printf 'Configuração do Next.js já existe. Pulando.\n'
fi

# ---------------------------------------------------------------------------
# 5. Instalar dependências do Node
# ---------------------------------------------------------------------------

log "5. Instalando dependências do Node"

npm install

# ---------------------------------------------------------------------------
# 6. Variáveis de ambiente
# ---------------------------------------------------------------------------

log "6. Escrevendo .env com variáveis de produção"

cat > "$APP_DIR/.env" <<ENV
DATABASE_PATH=$DATABASE_PATH
ADMIN_PASSWORD=$ADMIN_PASSWORD
SYNC_TOKEN=$SYNC_TOKEN
SYNC_DAILY_HOUR=17
SYNC_DAILY_ENABLED=1
SYNC_MAX_PAGES=10
SYNC_DELAY_MS=400
MIR4_RANK_BASE=https://forum.mir4global.com
APP_TIMEZONE=America/Sao_Paulo
ENV

printf 'Arquivo: %s/.env\n' "$APP_DIR"
printf 'Conteúdo:\n'
cat "$APP_DIR/.env"
printf '\n'

confirm "O .env está pronto. Você deve editar ADMIN_PASSWORD e SYNC_TOKEN antes de subir.
Opcional, se você quiser definir uma URL base pública para links e cookies no prod, descomente e preencha a linha abaixo no .env:
# NEXT_PUBLIC_BASE_URL=https://$DOMAIN
"

# ---------------------------------------------------------------------------
# 7. Build da aplicação
# ---------------------------------------------------------------------------

log "7. Buildando a aplicação"

npm run build

# ---------------------------------------------------------------------------
# 8. Instalando e configurando PM2
# ---------------------------------------------------------------------------

log "8. Configurando o processo com PM2"

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

pm2 --version

APP_NAME="mir4-ranking"

pm2 start \
  "$APP_DIR/node_modules/next/dist/bin/next" \
  --name "$APP_NAME" \
  -- start -p "$PORT" \
  --prefix "$APP_DIR"

pm2 save

log "PM2 startup precisa criar um sistema para iniciar no boot."
log "Rodando pm2 startup com sudo..."
pm2 startup | sudo bash - || true

printf '\n'
log "Status do PM2:"
pm2 status
printf '\n'

# ---------------------------------------------------------------------------
# 9. Nginx
# ---------------------------------------------------------------------------

log "9. Configurando nginx"

sudo tee "/etc/nginx/sites-available/$DOMAIN" >/dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
    }
}
NGINX

sudo rm -f "/etc/nginx/sites-enabled/default"
sudo ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

sudo mkdir -p /var/www/certbot
sudo chown -R "$USER:$USER" /var/www/certbot

sudo nginx -t
sudo systemctl reload nginx || sudo systemctl restart nginx

printf '\n'
log "Verificando se a porta está servindo localmente antes do HTTPS"
sleep 3
curl -sS -o /dev/null -w "HTTP Next.js: %{http_code}\n" "http://127.0.0.1:$PORT" || true
curl -sS -o /dev/null -w "Nginx proxy: %{http_code}\n" "http://127.0.0.1/" || true
printf '\n'

confirm "Nginx tá configurado e reloadado. Continuar para o HTTPS?"
  log "10. Configurando HTTPS com Let's Encrypt"

  sudo mkdir -p /var/www/certbot
  sudo certbot --nginx \
    -d "$DOMAIN" \
    ${EMAIL_FOR_LETSENCRYPT:+--email "$EMAIL_FOR_LETSENCRYPT"} \
    --agree-tos \
    --redirect \
    --hsts \
    --staple-ocsp \
    -n

  printf '\n'
  log "Testando renewal automático"
  sudo certbot renew --dry-run
else
  log "HTTPS não foi configurado. A app vai responder em http://$DOMAIN"
fi

# ---------------------------------------------------------------------------
# 10. Revisão final
# ---------------------------------------------------------------------------

log "10. Revisão final"

printf 'Status do serviço:\n'
pm2 status "$APP_NAME" --no-color || true
printf '\n'
printf 'Últimos logs do PM2:\n'
pm2 logs "$APP_NAME" --lines 20 --nostream --raw || true
printf '\n'
printf 'Nginx:\n'
sudo systemctl is-active nginx
sudo nginx -t
printf '\n'
printf 'Pronto:\n'
printf '  http://%s\n' "$DOMAIN"
printf '  https://%s\n' "$DOMAIN"
printf '  login: admin\n'
printf '  senha: %s\n' "$ADMIN_PASSWORD"
printf '\n'

log "FIM"
log "Se a app não subir, rode:"
log "  pm2 logs $APP_NAME --lines 50"
log "  pm2 describe $APP_NAME"
log "  sudo journalctl -u nginx --no-pager -n 50"
