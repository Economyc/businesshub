#!/bin/bash
# Deploy LEGADO de App1 a Oracle Cloud -> https://businesshub.myvnc.com
#
# Sustituido por deploy.sh (Hetzner/Coolify, hub.economyc.cc) el 2026-08-12.
# Se conserva mientras dure la transicion: Oracle sigue vivo y sirve el ultimo
# bundle que se le publico, asi que esto es el rollback si hub.economyc.cc falla.
# Cuando se de por buena la migracion, borrar este archivo, bajar la instancia
# de Oracle y cancelar el dominio No-IP (que es lo que se paga cada mes).
set -e

SSH_KEY="C:/Users/sbdbu/Documents/Empresas/businesshub-privatenecesarios/ssh-key-2026-03-22.key"
SERVER="ubuntu@134.65.233.213"
PROJECT_DIR="C:/Users/sbdbu/Documents/Empresas/businesshub"

cd "$PROJECT_DIR"

# Phase 1: Git
if [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-auto: save and deploy}"
  git add .
  git commit -m "$MSG"
  git push
  echo "✓ Git: committed and pushed"
else
  echo "✓ Git: nothing to commit"
fi

# Phase 2: Build & Deploy
npm run build --silent
tar -czf dist.tar.gz dist
scp -i "$SSH_KEY" dist.tar.gz "$SERVER":~
ssh -i "$SSH_KEY" "$SERVER" "sudo rm -rf /var/www/html/* && tar -xzf ~/dist.tar.gz && sudo cp -r dist/* /var/www/html/ && rm ~/dist.tar.gz"
rm dist.tar.gz
echo "✓ Deployed to http://134.65.233.213"
