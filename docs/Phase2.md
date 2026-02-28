# Phase 2 — Développement des services

## Objectif
Développer les 3 services backend et le front React avec le minimum fonctionnel pour pouvoir tout déployer.

> ⚠️ L'objectif n'est pas d'avoir une app parfaite — juste assez de fonctionnel pour pratiquer le DevOps.

---

## 2.1 Service Auth

### Ce que tu vas faire
- Register (POST /auth/register)
- Login (POST /auth/login)
- Logout (POST /auth/logout)
- Refresh token (POST /auth/refresh)
- Middleware de vérification JWT (pour les autres services)

### Stack
- Express + bcrypt + jsonwebtoken
- PostgreSQL (stockage users)
- Redis (blacklist des tokens révoqués)

### Schema BDD
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Variables d'environnement
```env
PORT=3001
DATABASE_URL=postgresql://user:pass@postgres:5432/auth_db
REDIS_URL=redis://redis:6379
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Questions de compréhension
- Pourquoi utiliser un refresh token en plus du access token ?
- Pourquoi stocker les tokens révoqués dans Redis plutôt que PostgreSQL ?
- Qu'est-ce que bcrypt et pourquoi ne pas stocker le mot de passe en clair ?

### Critères de validation
- [ ] Register crée un user en BDD avec mot de passe hashé
- [ ] Login retourne access token + refresh token
- [ ] Logout blackliste le token dans Redis
- [ ] Middleware JWT vérifie et décode le token

---

## 2.2 Service Profils

### Ce que tu vas faire
- GET /profiles/:userId — récupérer un profil
- PUT /profiles/:userId — modifier son profil
- GET /profiles — lister les users (pour la recherche)

### Stack
- Express + multer (upload avatar)
- PostgreSQL

### Schema BDD
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url VARCHAR(255),
  status VARCHAR(50) DEFAULT 'offline',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Variables d'environnement
```env
PORT=3002
DATABASE_URL=postgresql://user:pass@postgres:5432/profiles_db
AUTH_SERVICE_URL=http://auth:3001
```

### Questions de compréhension
- Comment ce service vérifie que l'utilisateur est authentifié ?
- Faut-il une BDD séparée par service ou une seule partagée ? Pourquoi ?

### Critères de validation
- [ ] GET /profiles/:userId retourne le profil
- [ ] PUT /profiles/:userId modifie le profil (auth required)
- [ ] Le middleware JWT fonctionne via appel au service auth

---

## 2.3 Service Messagerie

### Ce que tu vas faire
- WebSocket avec Socket.io (join room, send message, receive message)
- GET /messages/:roomId — historique des messages
- Publier un event RabbitMQ à chaque nouveau message

### Stack
- Express + Socket.io
- PostgreSQL (historique)
- Redis (rooms actives, presence)
- RabbitMQ (publish events)

### Schema BDD
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(100) NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Events Socket.io
```
Client → Serveur :
  join_room   { roomId }
  send_message { roomId, content }
  leave_room  { roomId }

Serveur → Client :
  new_message  { id, senderId, content, createdAt }
  user_joined  { userId }
  user_left    { userId }
```

### Variables d'environnement
```env
PORT=3003
DATABASE_URL=postgresql://user:pass@postgres:5432/messaging_db
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
AUTH_SERVICE_URL=http://auth:3001
```

### Questions de compréhension
- Pourquoi utiliser Redis pour les rooms actives plutôt que la BDD ?
- Quelle est la différence entre WebSocket et HTTP classique ?
- Pourquoi publier un event RabbitMQ à chaque message ?

### Critères de validation
- [ ] Deux clients peuvent s'envoyer des messages en temps réel
- [ ] L'historique des messages est sauvegardé en BDD
- [ ] Un event est publié dans RabbitMQ à chaque message

---

## 2.4 Front React

### Pages à créer
- `/login` — formulaire login
- `/register` — formulaire register
- `/chat` — liste des rooms + chat en temps réel
- `/profile` — voir/modifier son profil

### Ce que tu vas faire
- Appels API via Axios (pointer vers Nginx)
- Connexion Socket.io au service messagerie
- Gestion du JWT dans le front (stockage, refresh auto)
- État global simple avec Context API ou Zustand

### Variables d'environnement
```env
VITE_API_URL=http://localhost/api
VITE_SOCKET_URL=http://localhost
```

### Questions de compréhension
- Où stocker le JWT côté front ? (localStorage vs httpOnly cookie — avantages/inconvénients)
- Comment gérer l'expiration du access token automatiquement ?

### Critères de validation
- [ ] Login / Register fonctionnels
- [ ] Chat temps réel entre 2 onglets du navigateur
- [ ] Profil modifiable
- [ ] Déconnexion fonctionne

---

## Test global de la Phase 2
```bash
docker-compose up -d
# Tester manuellement avec Postman ou le front
# Vérifier que les 3 services communiquent bien
```