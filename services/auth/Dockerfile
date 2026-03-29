# Image Docker du service Auth
# Node 18 Alpine, utilisateur non-root, port 3001
FROM node:18-alpine

# CVE-2025-15467 (libcrypto3/libssl3 CRITICAL) — aligner sur les correctifs Alpine
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY src/ ./src/

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

CMD ["node", "src/index.js"]