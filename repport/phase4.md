# Phase 4 — Tests

## Définitions

**Outils :**
- **Jest** : Framework de tests JavaScript (unitaires, intégration, mocks, coverage).
- **Supertest** : Bibliothèque pour tester des API HTTP (requêtes simulées sur Express).
- **lcov** : Format de rapport de couverture de code (lignes, branches, fonctions).

**Concepts :**
- **Test unitaire** : Test d’une fonction ou module isolé, sans dépendances externes (ou mockées).
- **Test d’intégration** : Test d’un flux complet (ex. route HTTP + BDD + Redis) avec de vrais composants.
- **Coverage** : Pourcentage du code exécuté par les tests (lignes, branches, fonctions).
- **Mock** : Simulation d’un composant externe (ex. axios pour remplacer les appels au service auth).
- **AAA** : Pattern Arrange (préparer) → Act (agir) → Assert (vérifier).
- **--forceExit** : Option Jest pour forcer la sortie malgré des connexions (Redis, Postgres) non fermées.

**Aspects de la phase :** Automatiser la validation du code, garantir la non-régression, produire un rapport de couverture exploitable par SonarCloud et la CI.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

Introduire des tests automatisés (Jest + Supertest) pour valider les 3 services backend, avec :

- **Tests unitaires** : fonctions isolées (hash, JWT, validation)
- **Tests d'intégration** : routes HTTP avec vraie base PostgreSQL
- **Coverage** : minimum 70 % pour alimenter le pipeline CI (Phase 5, SonarCloud)

### 1.2 Place dans le flux DevOps

Phase 3 (Docker) → Phase 4 (Tests) → Phase 5 (SonarCloud) → Phase 6 (Jenkins)

↓

Jest + Supertest + coverage

↓

Validation qualité et régression avant déploiement

---

## 2. Infrastructure des tests

### 2.1 Outils

| Outil | Usage |
|---|---|
| **Jest** | Framework de tests (unitaires + intégration) |
| **Supertest** | Requêtes HTTP sur l'app Express |
| **PostgreSQL** | Base réelle pour les tests d'intégration |
| **Redis** | Auth (blacklist tokens) |
| **axios (mock)** | Service auth pour profiles et messaging |

### 2.2 Structure des tests

| Service | Tests unitaires | Tests d'intégration |
|---|---|---|
| **auth** | `hash.test.js`, `jwt.test.js`, `validate.test.js` | `auth.test.js` (register, login, health) |
| **profiles** | — | `profiles.test.js` (GET, PUT, auth, 401/403) |
| **messaging** | — | `messages.test.js` (GET messages, auth, 401) |

---

## 3. Détail des étapes et objectifs

### 3.1 — Service Auth

Tests unitaires (`tests/unit/`) :

| Fichier | Scénarios couverts |
|---|---|
| `hash.test.js` | `hashPassword` (format bcrypt, salt différent), `comparePassword` (match / no match) |
| `jwt.test.js` | Génération tokens, vérification (payload, format JWT), erreurs (token invalide, mauvais secret) |
| `validate.test.js` | Validation register (username, email, password), validation login, cas limites (vides, trop courts) |

Tests d'intégration (`tests/auth.test.js`) :

| Route | Scénarios |
|---|---|
| `POST /auth/register` | Création user (201), doublon email (400) |
| `POST /auth/login` | Login OK (200, tokens), mauvais mot de passe (401) |
| `GET /health` | Retourne 200 avec `status: ok` |

Infra : PostgreSQL + Redis via `DATABASE_URL` et `REDIS_URL` (variables d'environnement).

---

### 3.2 — Service Profiles

Tests d'intégration (`tests/profiles.test.js`) :

| Route | Scénarios |
|---|---|
| `GET /profiles` | Liste des profils (200, format attendu) |
| `GET /profiles/:userId` | 404 si profil absent, 200 après PUT |
| `PUT /profiles/:userId` | Création/mise à jour (200/201), 403 si autre user, 401 sans token, 401 si auth rejette |
| `GET /health` | 200 |

Mock axios : `jest.mock('axios')` + `axios.get.mockResolvedValue({ data: { userId } })` pour simuler le service auth. Le `authMiddleware` appelle `AUTH_SERVICE_URL/auth/verify` ; le mock remplace cet appel.

---

### 3.3 — Service Messaging

Tests d'intégration (`tests/messages.test.js`) :

| Route | Scénarios |
|---|---|
| `GET /messages/:roomId` | Liste de messages (200, format attendu), 401 sans token, 401 si auth rejette |
| `GET /health` | 200 |

Mock axios : même approche que profiles.

---

### 3.4 — Configuration Jest

`package.json` (auth, profiles, messaging) :

```json
{
  "scripts": {
    "test": "jest --forceExit",
    "test:coverage": "jest --coverage --forceExit"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

| Option | Objectif |
|---|---|
| `--forceExit` | Forcer la sortie propre malgré connexions Redis/Postgres persistantes |
| `--coverage` | Générer `coverage/lcov.info` pour SonarCloud |

---

### 3.5 — Variables d'environnement des tests

| Variable | Services | Usage |
|---|---|---|
| `DATABASE_URL` | auth, profiles, messaging | Connexion PostgreSQL |
| `REDIS_URL` | auth, messaging | Redis (blacklist, sessions) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | auth | Génération et vérification tokens |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | auth | Durées de validité |
| `AUTH_SERVICE_URL` | profiles, messaging | URL du service auth (mocké dans les tests) |

---

## 4. Difficultés rencontrées et solutions

| Problème | Solution |
|---|---|
| **Tables absentes en CI** | Créer `scripts/init-db.sql` (users, profiles, messages) et l'exécuter avant les tests dans le workflow GitHub Actions (Phase 5). |
| **profiles.id sans DEFAULT** | Ajouter `DEFAULT gen_random_uuid()` sur l'id de la table `profiles` pour les insertions. |
| **Connexions non fermées** | Utiliser `jest --forceExit` pour éviter que Jest attende les connexions Redis/Postgres. |
| **Auth externe pour profiles/messaging** | Mocker `axios` avec `jest.mock('axios')` pour remplacer les appels au service auth. |
| **Tests JWT sans env** | Définir `process.env.JWT_SECRET` et `JWT_REFRESH_SECRET` dans `beforeAll` des tests JWT. |

---

## 5. Synthèse des modifications

| Fichier / zone | Modification |
|---|---|
| `services/auth/tests/unit/hash.test.js` | Tests bcrypt (hash, compare) |
| `services/auth/tests/unit/jwt.test.js` | Tests génération et vérification JWT |
| `services/auth/tests/unit/validate.test.js` | Tests validateRegisterInput, validateLoginInput |
| `services/auth/tests/auth.test.js` | Tests intégration register, login, health |
| `services/profiles/tests/profiles.test.js` | Tests intégration GET, PUT, auth, 401/403 |
| `services/messaging/tests/messages.test.js` | Tests intégration GET messages, auth, 401 |
| `services/*/package.json` | Scripts `test`, `test:coverage`, dépendances jest, supertest |
| `scripts/init-db.sql` | Schéma BDD pour la Phase 5 (prérequis des tests d'intégration) |

---

## 6. Bonnes pratiques appliquées

1. **Structure AAA** : Arrange (données), Act (appel), Assert (assertions).
2. **Tests déterministes** : `Date.now()` pour éviter conflits d'emails.
3. **Mocks ciblés** : Mock d'`axios` uniquement pour profiles et messaging ; auth utilise la vraie DB.
4. **Isolation** : Chaque test utilise des utilisateurs distincts pour limiter les effets de bord.
5. **Scripts communs** : `test` et `test:coverage` identiques entre services.

---

## 7. Points importants

1. **Tests d'intégration = vraie DB** : PostgreSQL réel (pas de mock) pour valider le flux complet.
2. **Mock du service auth** : Profiles et messaging dépendent de l'auth ; le mock évite de lancer le service auth dans les tests.
3. **`init-db.sql` partagé** : Un seul schéma pour la CI (Phase 5) et pour l'exécution locale des tests.
4. **`--forceExit`** : Nécessaire car Redis/Postgres gardent des connexions ouvertes après les tests.
