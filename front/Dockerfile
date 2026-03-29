# Image Docker du front React (multi-stage)
# Stage 1 : build Vite avec variables VITE_* → Stage 2 : Nginx sert /dist
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_AUTH_URL
ARG VITE_PROFILES_URL
ARG VITE_SOCKET_URL
ARG VITE_API_URL
ARG VITE_SENTRY_DSN
ARG VITE_APP_VERSION

ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_PROFILES_URL=$VITE_PROFILES_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_APP_VERSION=$VITE_APP_VERSION

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
# libexpat CVE-2026-32767 (CRITICAL): fixed in 2.7.5-r0 — refresh index until base image includes it
RUN apk update && apk upgrade --no-cache libexpat
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]