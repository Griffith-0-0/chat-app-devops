# Phase 3 — Containerisation

## Objectif
Créer les Dockerfiles pour chaque service et s'assurer que tout tourne avec Docker Compose.

---

## Ce que tu vas faire
1. Créer un `Dockerfile` pour chaque service et le front
2. Optimiser les images (multi-stage build, .dockerignore)
3. Compléter le `docker-compose.yml` avec tous les services
4. Vérifier que l'app fonctionne entièrement via Docker

---

## Concepts à maîtriser avant de commencer

### Questions de compréhension
- Quelle est la différence entre une image Docker et un container ?
- Pourquoi utiliser un build multi-stage pour Node.js ?
- Qu'est-ce qu'un `.dockerignore` et pourquoi c'est important ?
- Quelle est la différence entre `CMD` et `ENTRYPOINT` dans un Dockerfile ?
- Pourquoi utiliser `node:18-alpine` plutôt que `node:18` ?

---

## Structure attendue

```
services/
├── auth/
│   ├── Dockerfile
│   └── .dockerignore
├── messaging/
│   ├── Dockerfile
│   └── .dockerignore
└── profiles/
    ├── Dockerfile
    └── .dockerignore
front/
├── Dockerfile
└── .dockerignore
```

---

## Bonnes pratiques Dockerfile à respecter
- Utiliser des images `alpine` pour réduire la taille
- Copier `package.json` avant le code source (cache layers)
- Utiliser un utilisateur non-root
- Multi-stage build pour le front (build puis nginx)
- Ne jamais copier `node_modules` (mettre dans `.dockerignore`)

---

## Docker Compose complet attendu

Ton `docker-compose.yml` doit inclure :

| Service | Port exposé |
|---------|-------------|
| front | 3000 |
| auth | 3001 |
| messaging | 3003 |
| profiles | 3002 |
| postgres | 5432 |
| redis | 6379 |
| rabbitmq | 5672 + 15672 (UI) |
| nginx | 80 |

### Points importants dans le docker-compose
- Utiliser des `healthcheck` sur postgres, redis, rabbitmq
- Utiliser `depends_on` avec `condition: service_healthy`
- Passer les variables d'environnement via `.env`
- Créer un réseau Docker dédié : `chat-network`
- Volumes pour persister les données postgres

---

## Nginx comme reverse proxy

Créer un fichier `nginx/nginx.conf` :
```
/           → front:3000
/api/auth   → auth:3001
/api/profiles → profiles:3002
/api/messages → messaging:3003
/socket.io  → messaging:3003 (avec upgrade WebSocket)
```

> ⚠️ La config WebSocket dans Nginx est différente du HTTP classique — Cursor peut t'aider à comprendre pourquoi.

---

## Commandes utiles
```bash
# Build et lancer tout
docker-compose up --build -d

# Voir les logs d'un service
docker-compose logs -f auth

# Vérifier l'état des containers
docker-compose ps

# Rebuild un seul service
docker-compose up --build -d auth

# Arrêter tout et supprimer les volumes
docker-compose down -v
```

---

## Critères de validation
- [ ] Chaque service a son `Dockerfile` avec multi-stage build
- [ ] Chaque service a son `.dockerignore`
- [ ] `docker-compose up --build` fonctionne sans erreur
- [ ] L'app est accessible sur `http://localhost`
- [ ] Le chat temps réel fonctionne via Docker
- [ ] Les données persistent après `docker-compose restart`
- [ ] Les images font moins de 200MB (vérifier avec `docker images`)

---

## Vérification taille des images
```bash
docker images | grep chat-app
```