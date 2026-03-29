# Image Docker du service Profiles
# Node 18 Alpine, utilisateur non-root, port 3002
FROM node:18-alpine

# CVE-2025-15467 (libcrypto3/libssl3 CRITICAL) — correctifs Alpine
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY src/ ./src/

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3002

CMD ["node", "src/index.js"]