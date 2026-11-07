#!/usr/bin/env bash
# setup-vps.sh
# Roteiro orientativo para subir o MIR4 Ranking Ops em Ubuntu.
#
# Como o Freebuff executa cada comando em seu próprio ambiente,
# NÃO rode este arquivo todo de uma vez no cliente. Use ele como
# guia e execute os blocos um a um, ou cole cada bloco no terminal
# da VPS na ordem.
#
# Edite as três variáveis abaixo antes de começar.
DOMAIN="seu-dominio.com.br"
APP_USER="mir4"
APP_DIR="/opt/mir4-ranking"
SSL_EMAIL="" # leave empty for now, certbot will ask interactively
