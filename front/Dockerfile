# Image Docker du front React (multi-stage)
# Stage 1 : build Vite avec variables VITE_* → Stage 2 : Nginx sert /dist
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_AUTH_URL
ARG VITE_PROFILES_URL
ARG VITE_SOCKET_URL
ARG VITE_API_URL

ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_PROFILES_URL=$VITE_PROFILES_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]