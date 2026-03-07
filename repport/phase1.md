# Phase 1 — Setup du projet

## Définitions

**Outils :**
- **Git** : Système de contrôle de versions pour suivre les modifications du code.
- **GitHub** : Hébergement de dépôts Git, collaboration et intégration CI.
- **npm** : Gestionnaire de paquets et exécuteur de scripts pour Node.js.
- **ESLint** : Linter JavaScript/Node.js pour détecter erreurs et appliquer des règles de style.
- **Docker Compose** : Orchestration de conteneurs via un fichier YAML (définition des services, réseaux, volumes).
- **PostgreSQL** : Base de données relationnelle.
- **Redis** : Base clé-valeur en mémoire (cache, sessions).
- **RabbitMQ** : Message broker pour la communication asynchrone entre services.

**Concepts :**
- **Monorepo** : Un seul dépôt Git contenant plusieurs projets ou services (vs multirepo).
- **package.json** : Manifeste npm (dépendances, scripts, métadonnées) par projet.
- **.gitignore** : Fichier listant les chemins exclus du versionning (secrets, artefacts, dépendances).
- **chat-network** : Réseau Docker dédié pour la communication entre conteneurs.

**Aspects de la phase :** Initialisation du projet, structure des dossiers, configuration des outils de base, préparation de l’infrastructure (BDD, cache, broker) sans logique métier.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

Poser la base du monorepo pour le projet Chat App : arborescence, services backend, front React, lint, et infra Docker minimale (PostgreSQL, Redis, RabbitMQ).

### 1.2 Place dans le flux DevOps

Phase 1 (Setup) → Phase 2 (Services) → Phase 3 (Docker) → Phase 4 (Tests) → ...

↓

Structure, ESLint, BDD + cache + message broker

↓

Base pour tout le reste du projet

---

## 2. Structure mise en place

### 2.1 Arborescence du monorepo

chat-app-DevOps/

├── .cursor/ # Règles et contexte Cursor

│ └── rules/

├── .github/

│ ├── workflows/ # GitHub Actions (Phase 5+)

│ └── dependabot.yml # Mises à jour dépendances (Phase 5)

├── docs/ # Documentation des phases

│ ├── Phase1.md → Phase12.md

├── front/ # App React + Vite

├── jenkins/ # Config Jenkins (Phase 6)

├── nginx/ # Reverse proxy (Phase 3)

├── scripts/ # Scripts utilitaires (init-db, etc.)

├── services/

│ ├── auth/

│ ├── messaging/

│ └── profiles/

├── CONTEXT.md # Contexte projet

├── PROGRESS.md # Suivi de progression

├── docker-compose.yml # Services + infra

├── .gitignore

└── README.md

### 2.2 Choix d’architecture : monorepo

- Un seul dépôt pour backend et front
- Gestion des dépendances par service
- Historique et releases partagés
- CI/CD unique (Jenkins, workflows) pour tout le projet

---

## 3. Détail des étapes et objectifs

### 3.1 — Dépôt GitHub

|Étape|Objectif|
|---|---|
|Création du repo|Espace de code centralisé|
|Premier clone|Environnement de dev local|

---

### 3.2 — Structure des dossiers

|Dossier|Rôle|
|---|---|
|`services/auth`|Service d’authentification|
|`services/profiles`|Service profils utilisateur|
|`services/messaging`|Service messagerie temps réel|
|`front/`|Application React|
|`docs/`|Documentation des phases|
|`jenkins/`|Config Jenkins|
|`scripts/`|Scripts (init DB, etc.)|

---

### 3.3 — Initialisation des services backend

Objectif : Chaque service Node.js a son propre `package.json`.

|Service|`npm init`|Scripts principaux|
|---|---|---|
|auth|✅|start, dev, lint, test, test:coverage|
|profiles|✅|start, dev, lint, test, test:coverage|
|messaging|✅|start, dev, lint, test, test:coverage|

Chaque service a son `package-lock.json` pour des builds reproductibles.

---

### 3.4 — Front React + Vite

Objectif : Projet front moderne avec Vite.

|Élément|Contenu|
|---|---|
|Commande|`npm create vite@latest front`|
|Framework|React|
|Bundler|Vite|
|Gestion d’état|Context API (AuthContext)|
|Routing|React Router|
|Scripts|dev, build, lint, preview|

Type de module : `"type": "module"` (ESM).

---

### 3.5 — Configuration ESLint

Objectif : Règles de qualité de code sur tous les services.

|Service|Config|Fichier|
|---|---|---|
|auth|Flat config (ESLint 9+)|`eslint.config.mjs`|
|profiles|Idem|`eslint.config.mjs`|
|messaging|Idem|`eslint.config.mjs`|
|front|Config Vite/React|`eslint.config.js`|

Scripts : `lint` et `lint:fix` dans chaque `package.json`.

---

### 3.6 — Docker Compose de base

Objectif : Lancer l’infra (base, cache, broker) pour le développement et les tests.

|Service|Image|Port|Rôle|
|---|---|---|---|
|postgres|postgres:15-alpine|5432|Base de données|
|redis|redis:7-alpine|6379|Cache, sessions, blacklist tokens|
|rabbitmq|rabbitmq:3-management-alpine|5672, 15672|Messages / événements|

Réseau : `chat-network` pour isoler les conteneurs.

Volumes : `postgres_data` pour la persistance de PostgreSQL.

> Le `docker-compose.yml` actuel inclut aussi auth, profiles, messaging, front, nginx (Phase 3). En Phase 1, seuls postgres, redis et rabbitmq sont lancés au départ.

---

### 3.7 — .gitignore

Objectif : Ne pas commiter dépendances, secrets et artefacts.

|Catégorie|Exclusions|
|---|---|
|Dépendances|`node_modules/`, `.npm`|
|Secrets|`.env`, `.env.local`, `.env.*.local`|
|Builds|`dist/`, `build/`, `.next/`|
|Logs|`logs/`, `*.log`|
|Docker|`.docker/`|
|IDE|`.vscode/`|
|Couverture|`coverage/`, `.nyc_output/`|
|Kubernetes|`kubeconfig`, `*.kubeconfig`|

---

## 4. Fichiers clés créés

|Fichier|Rôle|
|---|---|
|`.gitignore`|Exclusions Git|
|`docker-compose.yml`|Définition des services (infra + apps)|
|`CONTEXT.md`|Contexte, architecture, stack|
|`PROGRESS.md`|Suivi des phases|
|`services/*/package.json`|Dépendances et scripts par service|
|`front/package.json`|Dépendances et scripts du front|
|`services/*/eslint.config.mjs`|ESLint par service backend|
|`front/eslint.config.js`|ESLint du front|

---

## 5. Variables d’environnement (base)

|Variable|Service|Rôle|
|---|---|---|
|`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`|postgres|Accès BDD|
|`RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`|rabbitmq|Accès broker|

Les variables des services applicatifs (auth, profiles, messaging, front) sont ajoutées en Phase 2 et 3.

---

## 6. Points importants

1. Monorepo : Pas de `package.json` à la racine ; chaque service gère ses propres dépendances.
2. Environnements : `.env` et variantes ne sont jamais versionnés.
3. ESLint : Config par service pour s’adapter à Node ou React.
4. Réseau Docker : `chat-network` pour la communication inter-services.
5. Documentation : `CONTEXT.md` et `PROGRESS.md` comme références du projet.

---

## 7. Commandes de validation

# Infra

docker compose up -d postgres redis rabbitmq

docker compose ps

# Services (dev local)

cd services/auth && npm install && npm run lint

cd services/profiles && npm install && npm run lint

cd services/messaging && npm install && npm run lint

cd front && npm install && npm run lint