# Image Docker du service Profiles
# Node 20 Alpine, utilisateur non-root, port 3002
FROM node:20-alpine

# Aligner OpenSSL sur les derniers correctifs Alpine avant le scan Trivy
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3002

CMD ["node", "src/index.js"]
