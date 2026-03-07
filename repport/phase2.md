# Phase 2 — Développement des services

## Définitions

**Outils :**
- **Express** : Framework web Node.js pour créer des API REST.
- **bcrypt** : Bibliothèque de hachage de mots de passe (salt + dérivation).
- **JWT (JSON Web Token)** : Standard de token signé pour l’authentification (access + refresh).
- **Socket.io** : Bibliothèque pour la communication temps réel (WebSocket).
- **axios** : Client HTTP pour les appels inter-services.
- **React** : Bibliothèque UI pour construire des interfaces.
- **Vite** : Build tool rapide pour frontends (React, SPA).
- **React Router** : Routage côté client pour les SPA.

**Concepts :**
- **Microservices** : Architecture où chaque service a une responsabilité isolée (auth, profiles, messaging).
- **Middleware** : Fonction intermédiaire dans une chaîne de traitement (ex. vérification JWT).
- **Reverse proxy** : Serveur qui reçoit les requêtes et les redirige vers des backends (Nginx).
- **Blacklist** : Liste de tokens révoqués (ex. après logout) stockée en Redis.
- **Context API** : Mécanisme React pour partager un état global (ex. auth).

**Aspects de la phase :** Implémentation des routes, logique métier, communication inter-services, interface utilisateur, API Gateway pour exposer une entrée unique.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

Implémenter les 3 services backend et le front React pour une chat app fonctionnelle : inscription, connexion, chat temps réel, profils. Objectif : disposer d’un minimum viable pour les phases DevOps suivantes.

### 1.2 Place dans le flux DevOps

Phase 1 (Monorepo) → Phase 2 (Services) → Phase 3 (Docker) → Phase 4 (Tests) → ...

↓

auth + profiles + messaging + front

↓

Base fonctionnelle pour les tests et le déploiement

---

## 2. Architecture mise en place

### 2.1 Vue d’ensemble

|Service|Port|Technologies|Rôle|
|---|---|---|---|
|auth|3001|Express, bcrypt, JWT, PostgreSQL, Redis|Inscription, login, logout, refresh, vérification de token|
|profiles|3002|Express, PostgreSQL, axios|CRUD profils, appel au service auth|
|messaging|3003|Express, Socket.io, PostgreSQL, RabbitMQ, axios|Chat temps réel, historique, événements|
|front|80 (via Nginx)|React, Vite|Interface utilisateur|

### 2.2 Communication inter-services

- profiles et messaging : vérification JWT via `GET AUTH_SERVICE_URL/auth/verify` avec `Authorization: Bearer <token>`
- Nginx : reverse proxy (API, WebSocket, front) sur le port 80

---

## 3. Détail des étapes et objectifs

### 3.1 — Service Auth

Objectif : Gérer l’authentification (register, login, logout, refresh) et exposer un endpoint de vérification de token.

|Route|Méthode|Description|
|---|---|---|
|`/auth/register`|POST|Création utilisateur (username, email, password hashé)|
|`/auth/login`|POST|Authentification, retour access + refresh tokens|
|`/auth/logout`|POST|Blacklist du token dans Redis (TTL 15 min)|
|`/auth/refresh`|POST|Nouveau access token à partir du refresh token|
|`/auth/verify`|GET|Vérification du token (usage par profiles et messaging)|

Composants :

- `utils/hash.js` : `hashPassword`, `comparePassword` (bcrypt)
- `utils/jwt.js` : `generateAccessToken`, `generateRefreshToken`, `verifyAccessToken`, `verifyRefreshToken`
- `utils/validate.js` : `validateRegisterInput`, `validateLoginInput`
- `middleware/verifyToken.js` : vérification JWT + blacklist Redis (usage interne auth)
- `redis.js` : client Redis pour la blacklist

Schéma BDD : Table `users` (id UUID, username, email, password_hash, created_at).

---

### 3.2 — Service Profiles

Objectif : Gérer les profils utilisateur (display_name, avatar_url, status).

|Route|Méthode|Auth|Description|
|---|---|---|---|
|`/profiles`|GET|Non|Liste des profils|
|`/profiles/:userId`|GET|Non|Profil par userId|
|`/profiles/:userId`|PUT|Oui|Création/mise à jour (réservé au propriétaire)|

Middleware : `authMiddleware` appelle `AUTH_SERVICE_URL/auth/verify` pour valider le token et mettre `req.userId`.

Comportement :

- 403 si le userId du token ne correspond pas au userId modifié
- 401 si token absent ou invalide

Schéma BDD : Table `profiles` (id UUID, user_id UNIQUE, display_name, avatar_url, status, updated_at), avec `ON CONFLICT (user_id) DO UPDATE` pour upsert.

---

### 3.3 — Service Messaging

Objectif : Chat temps réel et historique des messages.

HTTP :

- `GET /messages/:roomId` : historique des messages (auth requise)

Socket.io :

- `join_room` : rejoindre une room
- `send_message` : envoi de message → enregistrement en BDD + broadcast `new_message` + publication RabbitMQ
- `leave_room` : quitter une room
- `user_joined`, `user_left` : présence

Middleware Socket : Vérification du token via `auth/verify` avant de traiter les événements.

RabbitMQ : Publication sur la queue `messages` à chaque nouveau message (`type: 'new_message'`).

Schéma BDD : Table `messages` (id, room_id, sender_id, content, created_at).

---

### 3.4 — Front React

Objectif : Interface utilisateur pour login, inscription, chat et profil.

|Page|Route|Description|
|---|---|---|
|Login|`/login`|Formulaire email/mot de passe|
|Register|`/register`|Inscription username/email/password|
|Chat|`/chat`|Salle de discussion temps réel (Socket.io)|
|Profile|`/profile`|Affichage et modification du profil|

Composants :

- `AuthContext` : état global (user, token, login, register, logout), tokens en localStorage
- `api/axios.js` : instances axios (authAPI, profilesAPI, messagesAPI) avec interceptor pour `Authorization: Bearer`
- `pages/Chat.jsx` : Socket.io client, historique via API, envoi en temps réel

Routage : React Router (BrowserRouter, Routes), redirection `/` → `/login`.

---

### 3.5 — Nginx (API Gateway)

Fichier : `nginx/nginx.conf`

|Path|Backend|Usage|
|---|---|---|
|`/api/auth/`|auth:3001|Endpoints auth|
|`/api/profiles/`|profiles:3002|Endpoints profils|
|`/api/messages/`|messaging:3003|API messages|
|`/socket.io/`|messaging:3003|WebSocket Socket.io|
|`/`|front:80|Application React|

---

## 4. Flux de données

### 4.1 Inscription / Connexion

1. Front : formulaire → `authAPI.post('/auth/register')` ou `authAPI.post('/auth/login')`
2. Nginx : proxy vers auth
3. Auth : validation, hash (register) ou comparaison (login), écriture en BDD
4. Réponse : tokens stockés dans localStorage, état AuthContext mis à jour

### 4.2 Chat temps réel

1. Front : connexion Socket.io avec token (`auth: { token }`)
2. Messaging : middleware → appel `auth/verify` → acceptation ou refus
3. Client : `join_room` → `send_message` → réception `new_message`
4. Messaging : INSERT en BDD, broadcast Socket.io, publication RabbitMQ

### 4.3 Profil

1. Front : `profilesAPI.get('/profiles/:userId')` avec token
2. Profiles : `authMiddleware` → `auth/verify` → lecture ou mise à jour en BDD
3. Réponse : affichage ou mise à jour du profil

---

## 5. Variables d'environnement

### Backend

|Variable|Services|Rôle|
|---|---|---|
|`DATABASE_URL`|auth, profiles, messaging|PostgreSQL|
|`REDIS_URL`|auth, messaging|Redis|
|`JWT_SECRET`, `JWT_REFRESH_SECRET`|auth|Signatures JWT|
|`JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`|auth|Durée de validité|
|`AUTH_SERVICE_URL`|profiles, messaging|URL du service auth|
|`RABBITMQ_URL`|messaging|Connexion RabbitMQ|

### Front

|Variable|Usage|
|---|---|
|`VITE_AUTH_URL`|Base URL pour auth (ex. `http://localhost/api`)|
|`VITE_PROFILES_URL`|Base URL pour profils|
|`VITE_API_URL`|Base URL pour messages|
|`VITE_SOCKET_URL`|URL Socket.io (ex. `http://localhost`)|

---

## 6. Synthèse des fichiers

|Fichier / zone|Contenu|
|---|---|
|`services/auth/src/routes/auth.js`|Routes register, login, logout, refresh, verify|
|`services/auth/src/utils/hash.js`|Bcrypt|
|`services/auth/src/utils/jwt.js`|Génération et vérification JWT|
|`services/auth/src/utils/validate.js`|Validation des entrées|
|`services/auth/src/middleware/verifyToken.js`|JWT + blacklist Redis|
|`services/profiles/src/routes/profiles.js`|GET /, GET /:userId, PUT /:userId|
|`services/profiles/src/middleware/authMiddleware.js`|Vérification via auth service|
|`services/messaging/src/index.js`|Socket.io, events, middleware auth|
|`services/messaging/src/routes/messages.js`|GET /:roomId|
|`services/messaging/src/rabbitmq.js`|Connexion et publication (avec retry)|
|`front/src/context/AuthContext.jsx`|État global auth|
|`front/src/pages/Login.jsx`, `Register.jsx`, `Chat.jsx`, `Profile.jsx`|Pages principales|
|`front/src/api/axios.js`|Instances axios + intercepteur token|
|`nginx/nginx.conf`|Reverse proxy, API, WebSocket|

---

## 7. Points importants

1. Séparation des responsabilités : Auth gère les tokens ; profiles et messaging les valident via `auth/verify`.
2. Blacklist Redis : Tokens révoqués après logout, TTL 15 min.
3. RabbitMQ : Événements `new_message` pour éventuel traitement asynchrone.
4. Context API : État auth centralisé pour les pages React.
5. Tokens en localStorage : Simple à implémenter ; pour une app plus sensible, privilégier des cookies httpOnly.