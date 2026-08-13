# Dockerfile de App1 (BusinessHub) para deploy en Coolify/Hetzner → hub.economyc.cc.
# En Coolify: Build Pack = Dockerfile, Dockerfile Location = /Dockerfile, Port = 80.
# Las VITE_FIREBASE_* se pasan como build args/env (Vite las inlinea en build) —
# definirlas en Coolify (Environment Variables, marcadas "Build").
#
# Reemplaza el deploy por scp a Oracle (deploy.sh). Espejo de Dockerfile.admin,
# con tres diferencias: usa `npm run build` (no build:admin), copia dist/ (no
# dist-admin/) y no renombra el HTML — el entry de App1 ya es index.html.

FROM node:20-alpine AS build
WORKDIR /app

# Args de Firebase: se vuelven ENV para que estén en process.env durante el build.
# El plugin validateFirebaseEnv() de vite.config.base.ts aborta el build si falta
# alguna, así que un olvido en Coolify falla ruidoso en vez de publicar un bundle
# con `apiKey: undefined` (pantalla blanca + auth/invalid-api-key).
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# Incluimos .npmrc (legacy-peer-deps=true) ANTES de npm ci: el repo lo necesita
# para resolver el conflicto de peer deps (zod 4 vs @ai-sdk/react que pide zod 3).
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# Limpiamos el contenido default de nginx (su index.html "Welcome to nginx").
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
