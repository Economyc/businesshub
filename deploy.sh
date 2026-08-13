#!/bin/bash
# Deploy de App1 (BusinessHub) a Hetzner/Coolify -> https://hub.economyc.cc
#
# Reemplaza el deploy viejo a Oracle (build local + tar + scp a /var/www/html).
# Ahora el build lo hace Coolify dentro del Dockerfile, asi que este script solo
# sube el codigo y dispara el rebuild. El deploy de Oracle quedo en deploy-oracle.sh
# por si hace falta volver mientras dure la transicion.
set -e

PROJECT_DIR="C:/Users/sbdbu/Documents/Empresas/businesshub"
APP_UUID="by6x7oqcm5a32r9my37hloi0"
SERVER="root@204.168.161.236"
SSH_KEY="$HOME/.ssh/id_rsa"
# El token NO se versiona: el repo Economyc/businesshub es publico.
TOKEN_FILE="C:/Users/sbdbu/Documents/Empresas/businesshub-privatenecesarios/coolify-token"

cd "$PROJECT_DIR"

TOKEN="${COOLIFY_API_TOKEN:-$(cat "$TOKEN_FILE" 2>/dev/null | tr -d '\r\n')}"
if [ -z "$TOKEN" ]; then
  echo "ERROR: falta el token de Coolify. Define COOLIFY_API_TOKEN o crea $TOKEN_FILE" >&2
  exit 1
fi

# La API de Coolify no es accesible desde fuera: hzcol.economyc.cc esta detras de
# Cloudflare Access y responde 302 al login. Por eso se llama a localhost:8000
# desde dentro del server, via SSH.
coolify() {
  ssh -i "$SSH_KEY" -o ConnectTimeout=20 "$SERVER" \
    "curl -s -H 'Authorization: Bearer $TOKEN' '$1'"
}

# Fase 1: Git
if [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-auto: save and deploy}"
  git add .
  git commit -m "$MSG"
  git push
  echo "OK Git: commiteado y pusheado"
else
  # OJO: si pre-commiteaste, el arbol esta limpio y aqui NO se pushea.
  # Coolify clona de GitHub, asi que un commit sin push desplegaria codigo viejo.
  git push 2>/dev/null && echo "OK Git: sin cambios nuevos, push verificado" \
    || echo "OK Git: nada que pushear"
fi

# Fase 2: disparar rebuild (no hay auto-deploy por webhook)
echo "Disparando build en Coolify..."
RESP=$(coolify "http://localhost:8000/api/v1/deploy?uuid=$APP_UUID&force=false")
DEPLOY_UUID=$(echo "$RESP" | grep -o '"deployment_uuid":"[^"]*"' | cut -d'"' -f4)

if [ -z "$DEPLOY_UUID" ]; then
  echo "ERROR: no se pudo encolar el deploy. Respuesta: $RESP" >&2
  exit 1
fi
echo "OK Encolado: $DEPLOY_UUID"

# Fase 3: esperar el resultado (build tipico 3-5 min)
echo -n "Compilando"
for i in $(seq 1 60); do
  sleep 10
  STATUS=$(coolify "http://localhost:8000/api/v1/deployments/$DEPLOY_UUID" \
           | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  case "$STATUS" in
    finished)
      echo ""
      echo "OK Desplegado en https://hub.economyc.cc"
      exit 0 ;;
    failed|cancelled)
      echo ""
      echo "ERROR: el build termino en '$STATUS'." >&2
      echo "Logs: https://hzcol.economyc.cc -> businesshub -> Deployments" >&2
      exit 1 ;;
    *)
      echo -n "." ;;
  esac
done

echo ""
echo "AVISO: el build sigue corriendo tras 10 min. Revisa el panel de Coolify."
