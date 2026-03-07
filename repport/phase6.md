# Phase 6 — Pipeline Jenkins

## Définitions

**Outils :**
- **Jenkins** : Serveur d’automatisation CI/CD (pipelines déclaratifs ou scriptés).
- **Jenkinsfile** : Fichier Groovy définissant les étapes du pipeline (stages, steps).
- **Trivy** : Scanner de vulnérabilités pour images Docker et autres artefacts.
- **Docker Hub** : Registre public d’images Docker.
- **Webhook** : Requête HTTP envoyée par GitHub à Jenkins à chaque push (déclenchement automatique).
- **ngrok** : Tunnel pour exposer un service local (Jenkins) à Internet (webhook en dev).

**Concepts :**
- **CI/CD** : Intégration continue (build, test) + livraison continue (push images, déploiement).
- **Pipeline déclaratif** : Jenkinsfile structuré avec `pipeline { stages { } }` (vs scripted).
- **Stage** : Étape logique du pipeline (Checkout, Lint, Tests, Build, etc.).
- **Agent** : Machine ou conteneur qui exécute les steps du pipeline.
- **Docker-out-of-Docker** : Jenkins dans Docker utilise le daemon Docker de l’hôte via le socket.
- **Credentials** : Secrets Jenkins (tokens, mots de passe) injectés via `withCredentials`.
- **Subshell** : `(cd dir && cmd)` — le `cd` est local, le répertoire courant parent ne change pas.

**Aspects de la phase :** Automatiser le cycle complet (lint → tests → analyse → build → scan → push), détecter les services modifiés dans un monorepo, sécuriser les images avant publication.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

Mettre en place un pipeline CI/CD Jenkins qui :

- Se déclenche à chaque push sur GitHub (webhook)
- Valide le code (lint, tests, qualité)
- Build les images Docker et les pousse sur Docker Hub
- Scanne les images avec Trivy avant publication

### 1.2 Place dans le flux DevOps

GitHub (push)

↓

Jenkins (Checkout → Lint → Tests → SonarCloud → Build → Trivy → Push)

↓

Docker Hub (images prêtes pour déploiement)

↓

(Phase 7+) Kubernetes / Argo CD

---

## 2. Infrastructure mise en place

### 2.1 Image Jenkins personnalisée (`jenkins/Dockerfile`)

Objectif : Une image Jenkins complète pour exécuter tout le pipeline sans dépendances externes.

| Composant | Rôle |
|---|---|
| `jenkins/jenkins:lts` | Base officielle Jenkins LTS |
| `docker-ce-cli` | Exécuter Docker depuis le conteneur (build, push) |
| Node.js 20 | `npm ci`, `npm run lint`, `npm run test:coverage` |
| Trivy | Scan sécurité des images Docker (vulnérabilités CRITICAL) |
| SonarScanner | Analyse SonarCloud (qualité / couverture) |

Jenkins est lancé en mode `privileged` avec `root` pour accéder au socket Docker.

### 2.2 Docker Compose Jenkins (`jenkins/docker-compose.jenkins.yml`)

Objectif : Lancer Jenkins avec accès au Docker de l'hôte.

| Paramètre | Rôle |
|---|---|
| `jenkins_data:/var/jenkins_home` | Persistance des jobs, config, historiques |
| `/var/run/docker.sock` | Utiliser le daemon Docker de l'hôte (build/push) |
| Ports 8080, 50000 | Interface Jenkins + agents |

Approche : Jenkins tourne dans Docker mais appelle Docker sur l'hôte (Docker-out-of-Docker).

---

## 3. Pipeline : étapes et objectifs

### Stage 1 — Checkout

Objectif : Récupérer le dépôt depuis GitHub (SCM).

Mise en œuvre : `checkout scm` (branche configurée dans le job).

Données : Workspace local avec le monorepo complet.

---

### Stage 2 — Detect Changed Services

Objectif : Ne construire et tester que les services modifiés dans le monorepo.

Mise en œuvre :

- `git diff --name-only HEAD~1 HEAD` pour lister les fichiers modifiés
- Test de présence de motifs : `services/auth`, `services/profiles`, etc.
- Variables `BUILD_AUTH`, `BUILD_PROFILES`, `BUILD_MESSAGING`, `BUILD_FRONT` en `true`/`false`

Bénéfice : Réduction du temps et des ressources lorsque seule une partie du projet change.

---

### Stage 3 — Install & Lint

Objectif : Installer les dépendances et vérifier la qualité du code (ESLint).

Mise en œuvre : Stages parallèles conditionnels (`when` sur `BUILD_*`) : `npm ci`, `npm run lint`.

Services : auth, profiles, messaging, front.

Données : Dépendances à jour et règles ESLint respectées.

---

### Stage 4 — Tests & Coverage

Objectif : Exécuter les tests avec couverture (Jest) dans un environnement proche de la prod.

Mise en œuvre :

- Variables d'environnement pour PostgreSQL, Redis, JWT, etc.
- `host.docker.internal` pour accéder à Postgres/Redis sur l'hôte

Services : auth (DB + Redis + JWT), profiles (DB + auth), messaging (DB + Redis + auth).

Données : Fichier `lcov.info` pour SonarCloud.

---

### Stage 5 — SonarCloud Analysis

Objectif : Analyser la qualité du code et la couverture de tests.

Mise en œuvre :

- `npm install -g sonar-scanner` à chaque exécution
- `(cd services/auth && sonar-scanner)` et de même pour profiles/messaging
- Utilisation de `sonar-project.properties` dans chaque service

Données : Rapports envoyés à SonarCloud (duplications, bugs, vulnérabilités, couverture).

---

### Stage 6 — Docker Build

Objectif : Construire les images pour les services modifiés.

Mise en œuvre :

- `docker build -t badrkhafif98/chat-auth:${BUILD_NUMBER} ./services/auth`
- Idem pour profiles, messaging, front

Données : Images taguées avec le numéro de build.

---

### Stage 7 — Trivy Security Scan

Objectif : Détecter les vulnérabilités des images avant push.

Mise en œuvre :

- `trivy image --exit-code 1 --severity CRITICAL`

Résultat : Pipeline échoue si au moins une vulnérabilité CRITICAL est trouvée.

---

### Stage 8 — Docker Push

Objectif : Publier les images sur Docker Hub pour le déploiement.

Mise en œuvre :

- Connexion via credentials Jenkins `dockerhub-credentials`
- `docker push` pour chaque image construite

Données : Images disponibles sur `hub.docker.com/r/badrkhafif98/`.

---

## 4. Difficultés rencontrées et solutions

### 4.1 ESLint — `'err' is defined but never used` (no-unused-vars)

Problème : Variable `catch (err)` déclarée mais jamais utilisée.

Cause : ESLint applique `no-unused-vars` aux paramètres de `catch`.

Solution :

- Renommer en `catch (_err)` dans auth, profiles, messaging
- Ajouter `caughtErrorsIgnorePattern: '^_'` dans les règles ESLint

Fichiers concernés : `verifyToken.js`, `auth.js`, `authMiddleware.js`, `rabbitmq.js`.

---

### 4.2 ESLint — `'process'` / `'Buffer'` is not defined (no-undef)

Problème : ESLint ne reconnaît pas les globals Node.js.

Cause : Config avec `globals.browser` au lieu de `globals.node`.

Solution : Remplacer par `globals.node` + `globals.jest` dans les `eslint.config.mjs` de profiles et messaging.

Effet : `process`, `Buffer`, `__dirname`, etc. sont reconnus.

---

### 4.3 SonarCloud — `The folder 'services/auth/tests' does not exist`

Problème : SonarCloud indique que le dossier `services/auth/tests` n'existe pas.

Cause : `docker run -v $PWD:/usr/src` dans un setup Jenkins-in-Docker. Le chemin `$PWD` (dans le conteneur Jenkins) n'existe pas tel quel pour le daemon Docker de l'hôte, donc montage incorrect ou vide.

Solution 1 (tentative) : Passer `sonar.tests` uniquement si le dossier existe. Toujours le même problème de montage.

Solution 2 (retenue) : Ne plus utiliser `docker run` pour Sonar. Exécuter `sonar-scanner` directement dans le conteneur Jenkins (workspace réel, pas montage).

Concrètement : `(cd services/auth && sonar-scanner)` au lieu de `docker run ... sonar-scanner`.

---

### 4.4 SonarCloud — `The folder 'services/auth/src' does not exist`

Problème : Même erreur pour `services/auth/src` quand SonarCloud tourne via `docker run`.

Cause : Même raison que ci-dessus (montage volume depuis un conteneur Jenkins).

Solution : Même approche — exécution directe de `sonar-scanner` dans le workspace Jenkins.

---

### 4.5 `sonar-scanner: not found`

Problème : Commande non trouvée après passage à l'exécution directe.

Cause : SonarScanner ajouté dans le Dockerfile, mais image Jenkins non reconstruite.

Solution : Ajouter `npm install -g sonar-scanner` avant les appels dans le Jenkinsfile.

Effet : Fonctionne même sans reconstruction de l'image.

---

### 4.6 `cd` en cascade après une erreur

Problème : `cd services/auth && sonar-scanner && cd ../..` : si `sonar-scanner` échoue, `cd ../..` ne s'exécute pas, le répertoire courant reste dans `services/auth`, et les commandes suivantes (`cd services/profiles`, etc.) échouent.

Solution : Utiliser des subshells `(cd services/auth && sonar-scanner)` pour chaque service.

Effet : Chaque `cd` est local à la sous-shell, le pipeline reste dans le workspace racine entre chaque exécution.

---

### 4.7 SonarCloud — paramètre `sonar.tests`

Problème : `sonar.tests=tests` dans `sonar-project.properties` provoquait des erreurs.

Solution : Retirer `sonar.tests` des `sonar-project.properties`. SonarCloud détecte les tests via les conventions et la couverture lcov reste utilisée.

---

## 5. Synthèse des modifications

| Fichier / zone | Modification |
|---|---|
| `jenkins/Dockerfile` | Node.js, Docker CLI, Trivy, SonarScanner |
| `Jenkinsfile` | Pipeline complète + SonarCloud sans docker run |
| `services/auth/eslint.config.mjs` | `globals.node`, `caughtErrorsIgnorePattern` |
| `services/profiles/eslint.config.mjs` | `globals.node` + `globals.jest`, `caughtErrorsIgnorePattern` |
| `services/messaging/eslint.config.mjs` | Idem profiles |
| `verifyToken.js`, `auth.js`, `authMiddleware.js`, `rabbitmq.js` | `catch (_err)` |
| `sonar-project.properties` (auth, profiles, messaging) | Suppression de `sonar.tests` |

---

## 6. Points importants

1. **Jenkins-in-Docker + volumes** : Les chemins du conteneur Jenkins ne correspondent pas à ceux du daemon Docker de l'hôte. Préférer exécuter les outils directement dans Jenkins plutôt que via `docker run` pour accéder au workspace.
2. **Monorepo** : La détection des services modifiés réduit le coût du pipeline.
3. **Parallélisation** : Les stages Lint et Tests en parallèle limitent le temps total.
4. **Sécurité** : Trivy bloque le push en cas de vulnérabilité CRITICAL.
5. **Credentials** : `SONAR_TOKEN` et `dockerhub-credentials` configurés dans Jenkins (System credentials) et injectés via `withCredentials`.
