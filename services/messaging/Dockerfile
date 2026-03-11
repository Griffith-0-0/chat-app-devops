# Image Docker du service Messaging
# Node 18 Alpine, utilisateur non-root, port 3003
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY src/ ./src/

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3003

CMD ["node", "src/index.js"]