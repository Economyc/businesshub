#!/bin/bash
set -e

# Deploy de App2 (herramienta admin) al servidor de Hetzner.
# Gemelo de deploy.sh (App1 → Oracle) pero apunta a dist-admin/ y a la caja de
# Hetzner. App1 NO se toca: se sigue desplegando con deploy.sh / skill deploy-oracle.
#
# ANTES DE USAR: rellenar HETZNER_IP y SSH_KEY con los datos reales del VPS.
# Mientras estén con el placeholder, el script aborta para no fallar a medias.

SSH_KEY="C:/Users/sbdbu/Documents/Empresas/businesshub-privatenecesarios/REEMPLAZAR-hetzner.key"
HETZNER_IP="REEMPLAZAR_IP_HETZNER"
SERVER_USER="root"
PROJECT_DIR="C:/Users/sbdbu/Documents/Empresas/businesshub"

if [[ "$HETZNER_IP" == REEMPLAZAR* || "$SSH_KEY" == *REEMPLAZAR* ]]; then
  echo "✗ Falta configurar HETZNER_IP y/o SSH_KEY en deploy-admin.sh"
  exit 1
fi

SERVER="$SERVER_USER@$HETZNER_IP"
cd "$PROJECT_DIR"

# Phase 1: Git (mismo repo que App1; si no hay cambios, no commitea)
if [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-auto: save and deploy admin}"
  git add .
  git commit -m "$MSG"
  git push
  echo "✓ Git: committed and pushed"
else
  echo "✓ Git: nothing to commit"
fi

# Phase 2: Build & Deploy de App2
npm run build:admin --silent
tar -czf dist-admin.tar.gz dist-admin
scp -i "$SSH_KEY" dist-admin.tar.gz "$SERVER":~
ssh -i "$SSH_KEY" "$SERVER" "sudo rm -rf /var/www/html/* && tar -xzf ~/dist-admin.tar.gz && sudo cp -r dist-admin/* /var/www/html/ && rm ~/dist-admin.tar.gz"
rm dist-admin.tar.gz
echo "✓ App2 desplegada en Hetzner ($HETZNER_IP)"
