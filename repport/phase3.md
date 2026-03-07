# Phase 3 — Containerisation Docker

## Définitions

**Outils :**
- **Docker** : Plateforme de conteneurisation (isolation des processus, images réutilisables).
- **Dockerfile** : Fichier de build définissant les étapes pour construire une image.
- **Docker Compose** : Déclaration YAML des services, réseaux et volumes pour lancer plusieurs conteneurs.
- **.dockerignore** : Fichier excluant des chemins du contexte de build (comme .gitignore pour Docker).
- **Nginx** : Serveur web et reverse proxy (routage, load balancing, WebSocket).

**Concepts :**
- **Image** : Snapshot immutable (OS + dépendances + code) servant de base aux conteneurs.
- **Conteneur** : Instance exécutable d’une image, isolée et éphémère.
- **Multi-stage build** : Plusieurs étapes `FROM` dans un Dockerfile (ex. build puis runtime) pour réduire la taille finale.
- **Layer** : Couche d’un image Docker ; l’ordre des instructions influence le cache.
- **Alpine** : Distribution Linux minimale, utilisée pour des images plus légères.
- **Non-root** : Exécution du processus en utilisateur non privilégié pour la sécurité.
- **Volume** : Persistance des données au-delà du cycle de vie des conteneurs.
- **Upstream** : Définition des backends cibles dans Nginx pour le reverse proxy.

**Aspects de la phase :** Packager les services en images, orchestrer avec Docker Compose, configurer le routage et l’accès unifié via Nginx.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

Créer les Dockerfiles pour chaque service et le front, puis faire tourner toute l'application avec Docker Compose (PostgreSQL, Redis, RabbitMQ, auth, profiles, messaging, front, Nginx).

### 1.2 Place dans le flux DevOps

Phase 2 (Services) → Phase 3 (Docker) → Phase 4 (Tests) → Phase 5 (SonarCloud) → ...

↓

Images Docker + orchestration locale

↓

Base pour les tests, la CI (Jenkins) et le déploiement K8s

---

## 2. Infrastructure mise en place

### 2.1 Vue d'ensemble

| Service | Image de base | Port | Rôle |
|---|---|---|---|
| auth | node:18-alpine | 3001 | Service authentification |
| profiles | node:18-alpine | 3002 | Service profils |
| messaging | node:18-alpine | 3003 | Service messagerie |
| front | node:18-alpine → nginx:alpine | 80 | App React (multi-stage) |
| nginx | nginx:alpine | 80 | Reverse proxy, API Gateway |
| postgres | postgres:15-alpine | 5432 | Base de données |
| redis | redis:7-alpine | 6379 | Cache, sessions |
| rabbitmq | rabbitmq:3-management-alpine | 5672, 15672 | Message broker |

### 2.2 Bonnes pratiques appliquées

- Images **alpine** pour réduire la taille
- Copie de `package*.json` avant le code (cache des layers)
- Utilisateur **non-root** (appuser) pour les services backend
- **Multi-stage build** pour le front (build Vite puis nginx)
- `.dockerignore` pour exclure node_modules, .env, logs

---

## 3. Détail des étapes et objectifs

### 3.1 — Dockerfile services backend (auth, profiles, messaging)

Structure commune :

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY src/ ./src/
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3xxx
CMD ["node", "src/index.js"]
```

| Étape | Objectif |
|---|---|
| `COPY package*.json` avant `COPY src/` | Exploiter le cache Docker : npm install ne se refait que si package.json change |
| `npm install --only=production` | Exclure les devDependencies (jest, eslint, etc.) |
| `adduser appuser` + `USER appuser` | Exécuter en non-root pour la sécurité |
| `EXPOSE` | Documenter le port (informative) |

---

### 3.2 — Dockerfile front (multi-stage)

| Stage | Objectif |
|---|---|
| **builder** | Build Vite avec les variables VITE_* |
| **nginx** | Servir les fichiers statiques générés |

```dockerfile
FROM node:18-alpine AS builder
ARG VITE_AUTH_URL
ARG VITE_PROFILES_URL
ARG VITE_SOCKET_URL
ARG VITE_API_URL
ENV VITE_*=...
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Les variables `VITE_*` sont injectées au build via les `ARG` du docker-compose pour pointer vers l'API (ex. `http://localhost/api`).

---

### 3.3 — .dockerignore

Objectif : Ne pas copier de fichiers inutiles dans le contexte de build.

**Services backend** (auth, profiles, messaging) :

```
node_modules
.env
*.log
```

**Front** :

```
node_modules
dist
.env
```

---

### 3.4 — Docker Compose complet

**Infrastructure** :

| Service | Image | Variables | Volumes |
|---|---|---|---|
| postgres | postgres:15-alpine | POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB | postgres_data |
| redis | redis:7-alpine | — | — |
| rabbitmq | rabbitmq:3-management-alpine | RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS | — |

**Services applicatifs** :

| Service | Build | Dépendances | Variables principales |
|---|---|---|---|
| auth | ./services/auth | postgres, redis | DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET |
| profiles | ./services/profiles | postgres, auth | DATABASE_URL, AUTH_SERVICE_URL |
| messaging | ./services/messaging | postgres, redis, rabbitmq, auth | DATABASE_URL, REDIS_URL, RABBITMQ_URL, AUTH_SERVICE_URL |
| front | ./front | — | VITE_* (ARG au build) |
| nginx | nginx:alpine | auth, profiles, messaging, front | — |

**Réseau** : `chat-network` pour l'isolation et la communication inter-services.

---

### 3.5 — Nginx (reverse proxy / API Gateway)

Fichier : `nginx/nginx.conf`

| Path | Backend | Usage |
|---|---|---|
| `/api/auth/` | auth:3001 | Endpoints auth |
| `/api/profiles/` | profiles:3002 | Endpoints profils |
| `/api/messages/` | messaging:3003 | API messages |
| `/socket.io/` | messaging:3003 | WebSocket (Upgrade, Connection) |
| `/` | front:80 | Application React |

Config WebSocket : `proxy_http_version 1.1`, `proxy_set_header Upgrade`, `proxy_set_header Connection "upgrade"` pour le handshake WebSocket.

---

## 4. Flux de requêtes

1. Client → `http://localhost` (port 80) → Nginx
2. Nginx route selon le path : `/api/auth/` → auth, `/api/profiles/` → profiles, etc.
3. Les services communiquent entre eux via les noms de service (auth, postgres, redis, rabbitmq)
4. Le front est servi en statique par Nginx depuis l'image front

---

## 5. Variables d'environnement

### Backend (docker-compose)

| Variable | Services | Valeur type |
|---|---|---|
| DATABASE_URL | auth, profiles, messaging | postgresql://user:password@postgres:5432/chat_db |
| REDIS_URL | auth, messaging | redis://redis:6379 |
| RABBITMQ_URL | messaging | amqp://user:password@rabbitmq:5672 |
| AUTH_SERVICE_URL | profiles, messaging | http://auth:3001 |
| JWT_SECRET, JWT_REFRESH_SECRET | auth | (à changer en prod) |

### Front (ARG au build)

| Variable | Valeur (dev local) |
|---|---|
| VITE_AUTH_URL | http://localhost/api |
| VITE_PROFILES_URL | http://localhost/api |
| VITE_API_URL | http://localhost/api |
| VITE_SOCKET_URL | http://localhost |

---

## 6. Synthèse des fichiers

| Fichier | Rôle |
|---|---|
| `services/auth/Dockerfile` | Image auth (node:18-alpine, non-root) |
| `services/profiles/Dockerfile` | Image profiles |
| `services/messaging/Dockerfile` | Image messaging |
| `front/Dockerfile` | Image front (multi-stage Vite + nginx) |
| `services/*/.dockerignore` | Exclusions build |
| `front/.dockerignore` | Exclusions build front |
| `docker-compose.yml` | Orchestration complète |
| `nginx/nginx.conf` | Reverse proxy, routage API, WebSocket |

---

## 7. Points importants

1. **Une BDD partagée** : `chat_db` utilisée par auth, profiles, messaging (schéma dans scripts/init-db.sql).
2. **Retry RabbitMQ** : Le service messaging inclut une logique de retry dans `rabbitmq.js` pour gérer le démarrage asynchrone.
3. **Variables VITE_*** : Injectées au build, pas au runtime (Vite remplace les `import.meta.env.VITE_*` à la compilation).
4. **Persistance** : Volume `postgres_data` pour conserver les données après `docker compose down`.
5. **Accès unique** : L'app est accessible via `http://localhost` (port 80), Nginx gère tout le routage.
