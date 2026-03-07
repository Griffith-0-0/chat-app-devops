# Phase 5 — Qualité de code

## Définitions

**Outils :**
- **SonarCloud** : Plateforme d’analyse statique hébergée (bugs, vulnérabilités, duplications, couverture).
- **SonarScanner** : CLI pour lancer une analyse et envoyer les résultats à SonarCloud/SonarQube.
- **Quality Gate** : Seuils à respecter pour valider une analyse (ex. coverage > 70 %, 0 bug bloquant).
- **Dependabot** : Service GitHub pour ouvrir des PR de mise à jour des dépendances (npm, Docker, etc.).
- **GitHub Actions** : Plateforme CI/CD intégrée à GitHub (workflows déclaratifs en YAML).

**Concepts :**
- **Analyse statique** : Analyse du code sans exécution (patterns, complexité, failles).
- **Code smell** : Indicateur de dette technique ou de mauvaise pratique.
- **sonar-project.properties** : Fichier de configuration SonarCloud (sources, tests, exclusions).
- **Flat config** : Nouvelle configuration ESLint (eslint.config.mjs) à la place de .eslintrc.
- **globals** : Variables globales reconnues par ESLint (process, Buffer, describe, it).
- **caughtErrorsIgnorePattern** : Règle ESLint pour ignorer les paramètres de catch préfixés par `_`.

**Aspects de la phase :** Mesurer et améliorer la qualité du code, sécuriser les dépendances, intégrer l’analyse dans la CI (GitHub Actions).

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

Mettre en place des outils de qualité de code (SonarCloud, ESLint, Dependabot) pour :

- **SonarCloud** : analyse statique (bugs, vulnérabilités, duplications) + couverture
- **ESLint** : règles de style et erreurs évidentes
- **Dependabot** : mises à jour hebdomadaires des dépendances npm

### 1.2 Place dans le flux DevOps

Phase 4 (Tests) → Phase 5 (Qualité) → Phase 6 (Jenkins CI)

↓

SonarCloud + ESLint + Dependabot

↓

Qualité validée avant build Docker

---

## 2. Infrastructure mise en place

### 2.1 SonarCloud

Objectif : Analyser les 3 services backend (auth, profiles, messaging).

| Élément | Contenu |
|---|---|
| Organisation | `griffith-0-0` sur sonarcloud.io |
| Projets | `chat-app_auth`, `chat-app_profiles`, `chat-app_messaging` |
| Fichier de config | `sonar-project.properties` par service |
| Quality Gate | Sonar way (Coverage > 70 %, 0 bug bloquant, etc.) |

### 2.2 GitHub Actions (workflow SonarCloud)

Fichier : `.github/workflows/sonarcloud.yml`

Objectif : Exécuter tests + SonarCloud à chaque push/PR sur `main` / `master`.

| Composant | Rôle |
|---|---|
| Services Postgres + Redis | Bases de données pour les tests d'intégration |
| `scripts/init-db.sql` | Création des tables avant les tests |
| Steps par service | Install → Tests avec coverage → SonarCloud Scan |
| Secret `SONAR_TOKEN` | Authentification SonarCloud |

### 2.3 ESLint

Objectif : Règles uniformes sur tous les services.

| Élément | Contenu |
|---|---|
| Config | `eslint.config.mjs` (flat config) par service |
| Règles | `globals.node`, `globals.jest`, `caughtErrorsIgnorePattern` |
| Scripts | `lint`, `lint:fix` dans chaque `package.json` |

### 2.4 Dependabot

Fichier : `.github/dependabot.yml`

Objectif : Ouvrir des PR pour mettre à jour les dépendances npm chaque semaine.

| Écosystème | Répertoires |
|---|---|
| npm | `services/auth`, `services/profiles`, `services/messaging`, `front` |

---

## 3. Détail des étapes et objectifs

### 3.1 — Configuration SonarCloud

| Étape | Objectif | Détail |
|---|---|---|
| Création organisation | Créer l'espace projet | Via sonarcloud.io + GitHub |
| Import du repo | Associer le monorepo | Un projet SonarCloud par service |
| `SONAR_TOKEN` | Authentifier la CI | Secret GitHub Actions |

Fichier `sonar-project.properties` (ex. auth) :

```properties
sonar.projectKey=chat-app_auth
sonar.sources=src
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.host.url=https://sonarcloud.io
sonar.organization=griffith-0-0
```

> `sonar.tests` est omis pour éviter des erreurs de chemins dans certains contextes (Jenkins-in-Docker).

---

### 3.2 — Workflow GitHub Actions SonarCloud

| Step | Objectif |
|---|---|
| Checkout | Récupérer le code |
| Setup Node.js 20 | Environnement d'exécution |
| Services Postgres + Redis | BDD pour les tests d'intégration |
| Init database | Exécuter `scripts/init-db.sql` (tables users, profiles, messages) |
| Pour chaque service (auth, profiles, messaging) | Install → Tests avec coverage → SonarCloud Scan |
| Env vars (DATABASE_URL, REDIS_URL, JWT_*, AUTH_SERVICE_URL) | Configurer les tests d'intégration |

Résultat : Rapport SonarCloud à jour sur chaque push.

---

### 3.3 — Initialisation base de données (`scripts/init-db.sql`)

Objectif : Fournir le schéma attendu par les tests d'intégration en CI.

| Table | Champs principaux |
|---|---|
| users | id (UUID), username, email, password_hash |
| profiles | id (UUID, DEFAULT gen_random_uuid()), user_id, display_name, avatar_url, status |
| messages | id (UUID), room_id, sender_id, content |

---

### 3.4 — ESLint (flat config)

Objectif : Règles communes et support Node.js / Jest.

| Option | Utilité |
|---|---|
| `globals.node` | `process`, `Buffer`, `__dirname` |
| `globals.jest` | `describe`, `it`, `expect` |
| `caughtErrorsIgnorePattern: '^_'` | Accepter `catch (_err)` si non utilisé |
| `argsIgnorePattern: '^_'` | Accepter les paramètres préfixés par `_` |
| `no-console: warn` | Alerter sur les `console.log` en prod |

---

### 3.5 — Dependabot

Objectif : Proposer des PR de mise à jour npm chaque semaine.

- 4 dossiers npm : `services/auth`, `services/profiles`, `services/messaging`, `front`
- La section Docker a été retirée (erreurs sur le monorepo)

---

## 4. Difficultés rencontrées et solutions

| Problème | Solution |
|---|---|
| **Dependencies lock file not found** | Supprimer `cache: 'npm'` de setup-node (monorepo sans package-lock à la racine) |
| **Connection refused localhost:9000** | Ajouter `sonar.host.url=https://sonarcloud.io` dans sonar-project.properties |
| **sonar.organization manquant** | Ajouter `sonar.organization=griffith-0-0` dans chaque sonar-project.properties |
| **Tables absentes en CI** | Créer scripts/init-db.sql + étape Init database (psql) avant les tests |
| **profiles.id sans DEFAULT** | Ajouter `DEFAULT gen_random_uuid()` pour l'id de la table profiles |
| **Dependabot Docker erreur** | Retirer la section Docker de dependabot.yml |

---

## 5. Synthèse des modifications

| Fichier / zone | Modification |
|---|---|
| `services/auth/sonar-project.properties` | Config SonarCloud (sans sonar.tests) |
| `services/profiles/sonar-project.properties` | Idem |
| `services/messaging/sonar-project.properties` | Idem |
| `.github/workflows/sonarcloud.yml` | Workflow CI : Postgres, Redis, init DB, tests, SonarCloud |
| `scripts/init-db.sql` | Schéma BDD pour les tests |
| `services/*/eslint.config.mjs` | Flat config avec globals Node/Jest et caughtErrorsIgnorePattern |
| `.github/dependabot.yml` | Mises à jour npm hebdomadaires sur 4 répertoires |

---

## 6. Points importants

1. **SonarCloud vs SonarQube** : SonarCloud est hébergé ; `sonar.host.url` et `sonar.organization` doivent être configurés.
2. **Tests en CI** : Les tests d'intégration nécessitent Postgres et Redis ; le workflow les lance via les services GitHub Actions.
3. **init-db.sql** : Nécessaire pour que les tests créent les tables avant d'exécuter les requêtes.
4. **ESLint flat config** : `eslint.config.mjs` (ESLint 9+) ; `globals.node` et `globals.jest` évitent les erreurs `no-undef` pour `process` et les variables Jest.
5. **Dependabot** : En monorepo sans Dockerfile à la racine, la section Docker peut poser problème ; souvent désactivée.
