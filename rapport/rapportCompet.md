# Rapport de compétences — Chat App DevOps

**Document de synthèse** : ce rapport consolide le travail réalisé sur le projet **Chat App** en s’appuyant sur les rapports de phases du dossier `repport/` (phases 1 à 12). Les fiches `docs/Phase*.md` complètent le cadre pédagogique ; les phases 13 à 17 y décrivent surtout des évolutions possibles (multi-environnements, fonctionnalités avancées, SLO, durcissement étendu) et ne sont pas traitées ici comme un état d’achèvement au même niveau de détail que `repport/`.

**Périmètre fonctionnel** : application de chat avec authentification, profils, messagerie temps réel, API unifiée derrière Nginx, infrastructure conteneurisée, chaîne CI/CD, déploiement Kubernetes, GitOps, observabilité et alerting, puis durcissement sécurité réseau et conteneurs.

---

## 1. Vue d’ensemble du parcours

| Phase | Thème | Apport principal |
|------:|--------|------------------|
| 1 | Setup monorepo | Structure du dépôt, outils de base, infra Docker minimale |
| 2 | Services applicatifs | Auth, profiles, messaging, front React, gateway Nginx |
| 3 | Containerisation | Dockerfiles, Compose complet, bonnes pratiques |
| 4 | Tests | Jest, Supertest, couverture, mocks |
| 5 | Qualité | SonarCloud, GitHub Actions, ESLint, Dependabot |
| 6 | Jenkins | Pipeline complet, détection monorepo, Trivy, Docker Hub |
| 7 | Kubernetes (Minikube) | Manifests, Ingress, gateway interne, accès `chat-app.local` |
| 8 | Helm | Charts paramétrables, ressources, upgrade / rollback |
| 9 | Argo CD | GitOps, sync auto, self-heal |
| 10 | Monitoring | Prometheus, Grafana, métriques, Loki, Promtail, Sentry |
| 11 | Alerting | Règles Prometheus, Alertmanager, Discord |
| 12 | Sécurité K8s | Secrets, Network Policies, SecurityContext, images |

Flux global : **code dans Git** → **CI (GitHub Actions + Jenkins)** → **images** → **cluster (Helm / Argo CD)** → **observabilité et alertes** → **posture sécurité**.

---

## 2. Phase 1 — Mise en place du projet

**Objectif** : poser les fondations d’un **monorepo** (backend multi-services + front + documentation + scripts).

**Réalisations principales** :

- Arborescence : `services/auth`, `services/profiles`, `services/messaging`, `front/`, `docs/`, `jenkins/`, `nginx/`, `scripts/`, workflows GitHub prévus.
- Chaque service backend possède son propre `package.json` et ses scripts (`start`, `dev`, `lint`, `test`, `test:coverage`).
- Front **React + Vite**, routing React Router, état auth via Context API.
- **ESLint** : flat config côté services (`eslint.config.mjs`), config adaptée au front.
- **Docker Compose** de base : **PostgreSQL 15**, **Redis 7**, **RabbitMQ 3** (management), réseau `chat-network`, volume pour Postgres.
- **`.gitignore`** : exclusion de `node_modules`, `.env`, artefacts de build, logs, coverage, fichiers sensibles K8s.

**Points clés** : pas de `package.json` racine unique ; isolation des dépendances par service ; documentation projet (`CONTEXT.md`, `PROGRESS.md`).

---

## 3. Phase 2 — Développement des services

**Objectif** : livrer une **chat app exploitable** (MVP) pour enchaîner sur Docker, tests et déploiement.

### 3.1 Service Auth (port 3001)

- **Express**, **bcrypt**, **JWT** (access + refresh), **PostgreSQL**, **Redis** (blacklist après logout).
- Routes : register, login, logout, refresh, **verify** (consommée par les autres services).
- Schéma : table `users`.

### 3.2 Service Profiles (port 3002)

- CRUD profils (`display_name`, `avatar_url`, `status`).
- Middleware appelant `AUTH_SERVICE_URL/auth/verify` ; contrôle 401/403 (propriétaire).
- Schéma : table `profiles` avec upsert sur `user_id`.

### 3.3 Service Messaging (port 3003)

- **Socket.io** : rooms, messages temps réel, présence.
- **RabbitMQ** : publication d’événements (ex. `new_message`).
- HTTP : historique `GET /messages/:roomId`.
- Schéma : table `messages`.

### 3.4 Front React

- Pages : login, register, chat, profil ; instances **axios** avec intercepteur Bearer ; client Socket.io avec token.

### 3.5 Nginx (API Gateway)

- Routage : `/api/auth/` → auth, `/api/profiles/` → profiles, `/api/messages/` → messaging, `/socket.io/` → messaging, `/` → front.

**Compétences démontrées** : architecture microservices, validation de tokens déléguée à un service central, intégration temps réel et broker de messages.

---

## 4. Phase 3 — Containerisation Docker

**Objectif** : exécuter **toute l’application** via Docker Compose avec une entrée unique.

**Réalisations** :

- **Dockerfiles** backend : `node:18-alpine`, cache `package*.json`, `npm install --only=production`, utilisateur non-root, exposition des ports métier.
- **Front** : build **multi-étapes** (build Vite puis image `nginx:alpine` pour servir les statiques).
- **`.dockerignore`** sur chaque contexte de build.
- **Compose** : auth, profiles, messaging, front, nginx, postgres, redis, rabbitmq ; variables d’environnement alignées (URLs internes `http://auth:3001`, etc.).
- **Nginx** : proxy HTTP + **WebSocket** (headers `Upgrade` / `Connection`).

**Points clés** : variables **Vite** injectées au **build** ; persistance Postgres ; retry RabbitMQ côté messaging pour le démarrage.

---

## 5. Phase 4 — Tests automatisés

**Objectif** : **Jest + Supertest**, couverture pour alimenter la qualité en CI (objectif ~70 % côté Sonar).

**Auth** :

- Unitaires : `hash`, `jwt`, `validate`.
- Intégration : register, login, health, avec vraie PostgreSQL + Redis.

**Profiles / Messaging** :

- Intégration avec **mock axios** pour simuler `auth/verify`.
- Scénarios GET/PUT profils, codes 401/403 ; messages par room + auth.

**Configuration** : `jest --coverage`, `--forceExit` pour limiter les blocages liés aux connexions ouvertes.

**Difficultés résolues** : schéma BDD pour la CI (`scripts/init-db.sql`), `DEFAULT gen_random_uuid()` sur `profiles.id`, env JWT dans les tests.

---

## 6. Phase 5 — Qualité de code et CI GitHub

**Objectif** : **SonarCloud**, **ESLint** homogène, **Dependabot**, workflow **GitHub Actions**.

**SonarCloud** :

- Projets par service backend ; `sonar-project.properties` (sources, `lcov`, organisation, `sonar.host.url`).
- Workflow : services **Postgres + Redis**, exécution de `init-db.sql`, puis tests avec couverture et scan.

**ESLint** : flat config, `globals.node` / `globals.jest`, patterns pour paramètres/catch non utilisés.

**Dependabot** : mises à jour npm hebdomadaires sur les quatre répertoires applicatifs (section Docker retirée si source d’erreurs en monorepo).

**Difficultés résolues** : cache npm à la racine, organisation Sonar manquante, tables absentes en CI, ajustements `profiles` et Dependabot.

---

## 7. Phase 6 — Pipeline Jenkins

**Objectif** : pipeline **CI/CD** déclenché par GitHub (webhook), avec build d’images et publication.

**Image Jenkins personnalisée** (`jenkins/Dockerfile`) : Jenkins LTS, CLI Docker, Node 20, Trivy, Sonar Scanner ; mode privilégié / socket Docker hôte pour **Docker-out-of-Docker**.

**Étapes typiques du `Jenkinsfile`** :

1. Checkout  
2. **Détection des services modifiés** (`git diff`) pour ne builder que le nécessaire  
3. Install + **lint** (parallèle, conditionnel)  
4. **Tests + couverture** (accès BDD/Redis sur l’hôte via `host.docker.internal` selon config)  
5. **SonarCloud** : exécution de `sonar-scanner` **dans le workspace** (éviter `docker run` avec mauvais montage de volumes)  
6. **Docker build** avec tag `BUILD_NUMBER`  
7. **Trivy** : échec si vulnérabilités **CRITICAL**  
8. **Push Docker Hub** avec credentials Jenkins  

**Problèmes résolus** : ESLint `no-unused-vars` sur `catch`, `no-undef` sur globals Node, chemins Sonar avec Jenkins-in-Docker, usage de **subshells** `(cd … && …)` pour ne pas casser le répertoire courant, retrait de `sonar.tests` problématique.

---

## 8. Phase 7 — Kubernetes sur Minikube

**Objectif** : déployer la stack sur **K8s local** avec **Ingress** et hostname **`http://chat-app.local`**.

**Manifests** (`k8s/base/`) :

- Namespace `chat-app`
- **Ingress** : tout le trafic vers le service **nginx** interne (contournement des limitations Ingress Minikube sur regex/snippets)
- **Nginx** en gateway : ConfigMap + Deployment + Service (même logique de routage que Compose)
- Déploiements **auth, profiles, messaging, front** : ConfigMaps, Secret JWT pour auth, probes **readiness/liveness** sur `/health`
- **Postgres** en **StatefulSet** + PVC ; **Redis** et **RabbitMQ** en Deployment

**Opérations** : `minikube image build` / load, `imagePullPolicy: Never` en dev local, init BDD via `kubectl exec … psql < scripts/init-db.sql`, **`minikube tunnel`** + `/etc/hosts` vers `127.0.0.1`.

**Correctifs notables** : passage du front à **Node 20** pour Vite ; message d’erreur API sur la page d’inscription.

---

## 9. Phase 8 — Helm

**Objectif** : packager les services applicatifs en **charts** (auth, profiles, messaging, front) avec `values.yaml` (image, tag, ressources, env, secrets pour auth).

**Pratiques** :

- `helm lint`, `helm upgrade --install`, changement de tag puis **rollback**
- Ressources **requests/limits** → QoS **Burstable**
- Infra (postgres, redis, rabbitmq) reste en manifests `k8s/base` ; ordre de déploiement : infra → auth/profiles → messaging → front

**Pièges** : conflit entre ressources créées par `kubectl apply` et prise en charge Helm → parfois suppression du namespace et réinstallation ; messaging en **CrashLoop** si RabbitMQ absent → redémarrage après infra.

---

## 10. Phase 9 — Argo CD (GitOps)

**Objectif** : **Git comme source de vérité**, synchronisation automatique vers le cluster.

**Réalisations** :

- Installation Argo CD (namespace `argocd`), UI via `kubectl port-forward`
- Connexion du dépôt GitHub
- Applications par service (chemins `helm/auth`, etc., namespace `chat-app`)
- **Sync automatique** et **self-heal** (ex. `kubectl scale` corrigé par resync)

**Note** : l’infra hors Helm reste appliquée par `kubectl` avant la synchro des applications métier.

---

## 11. Phase 10 — Monitoring (Prometheus, Grafana, Loki, Sentry)

**Objectif** : observabilité **métriques + logs + erreurs**.

**kube-prometheus-stack** (namespace `monitoring`) : Prometheus, Grafana, Alertmanager, exporters.

**Métriques applicatives** : bibliothèque **prom-client** ; route **`/metrics`** ; compteurs typiques sur l’auth (logins réussis/échoués, inscriptions) ; extension aux autres services selon le rapport de phase ; **ServiceMonitors** pour le scrape ; **dashboard Grafana** dédié Chat App.

**Logs** : stack **Loki + Promtail** (chart `loki-stack`, fichier `loki-stack-values.yaml` pour compatibilité Grafana / datasource par défaut).

**Sentry** : instrumentation **Node** (fichiers `instrument.js`, handler Express) et **front** (SDK React, plugin Vite, source maps) ; secrets et DSN à traiter comme sensibles (préférer secrets managés plutôt que valeurs en clair dans le dépôt).

---

## 12. Phase 11 — Alerting (Prometheus → Alertmanager → Discord)

**Objectif** : notifier les incidents (ex. indisponibilité du service auth) sur **Discord**.

**Réalisations** :

- `PrometheusRule` : alertes dont **AuthServiceMissing** basée sur `absent(up{namespace="chat-app", job="auth"})` (pertinent quand il n’y a plus de pod / plus de cible scrape)
- **AlertmanagerConfig** : route **critical** vers Discord ; webhook stocké dans un **Secret** Kubernetes (pas dans Git)
- Ajustement Helm **`alertmanagerConfigMatcherStrategy: None`** pour que les alertes du namespace `chat-app` ne soient pas filtrées par erreur comme `namespace=monitoring`

**Validation** : cycle scale auth à 0 → alerte **FIRING** → notification Discord → scale à 1 → **RESOLVED**.

---

## 13. Phase 12 — Sécurité Kubernetes

**Objectif** : durcir le déploiement : **secrets**, **Network Policies**, **SecurityContext**, gestion des **images**.

**Audit secrets** : JWT et données sensibles dans des **Secret** ; rappel rotation (`openssl rand -base64 32`) ; vigilance sur l’historique Git pour `.env`.

**Network Policies** (`k8s/base/network-policies/`) :

- **default-deny** ingress + egress
- Autorisation ingress depuis **ingress-nginx** vers les APIs
- Autorisation vers **postgres / redis / rabbitmq** depuis les pods applicatifs
- **Egress DNS** (UDP/TCP 53) et **egress intra-namespace** (sinon résolution DNS et communication interne cassées après default-deny)

**SecurityContext** :

- Services Node.js : `runAsNonRoot`, `readOnlyRootFilesystem`, `capabilities.drop: ["ALL"]`, volume `emptyDir` sur `/tmp`
- Nginx / front : compromis documenté (images officielles nécessitant parfois des opérations type `chown`) — pas de `drop ALL` systématique sur ces images

**Images** : `imagePullSecrets` pour Docker Hub si besoin ; `imagePullPolicy: Never` cohérent avec builds locaux Minikube ; résolution des erreurs **ErrImageNeverPull** / **ImagePullBackOff**.

---

## 14. Synthèse des compétences techniques acquises

- **Développement** : API REST Node/Express, WebSocket, JWT, PostgreSQL, Redis, RabbitMQ, React/Vite.
- **Conteneurs** : Dockerfile, multi-stage, Compose, bonnes pratiques de sécurité de base.
- **Tests & qualité** : Jest, Supertest, couverture, SonarCloud, ESLint, Dependabot.
- **CI/CD** : GitHub Actions, Jenkins déclaratif, scan Trivy, publication de registre.
- **Orchestration** : Kubernetes (Pods, Deployments, StatefulSet, Services, Ingress, ConfigMap, Secret, probes).
- **Packaging & GitOps** : Helm (values, upgrade, rollback), Argo CD (sync, self-heal).
- **Observabilité** : Prometheus, Grafana, métriques custom, Loki, Promtail, Sentry.
- **Exploitation** : règles d’alerte, Alertmanager, intégration Discord, stratégie de matching multi-namespace.
- **Sécurité** : Network Policies (Calico), durcissement des pods, gestion des secrets et des pulls d’images.

---

## 15. Pistes documentées au-delà de la phase 12 (`docs/`)

Les fichiers `docs/Phase13.md` à `Phase17.md` décrivent notamment : **multi-environnements** (Kustomize / Argo par env), **fonctionnalités produit** (groupes, notifications, recherche, export), **observabilité avancée** (traces OpenTelemetry / Jaeger, SLO/runbooks), et **sécurité étendue** (RBAC, SOPS, scans config). Ils servent de **cadre d’approfondissement** ; le détail du travail **réalisé et rapporté** s’arrête à la **phase 12** dans `repport/`.

---

*Rapport généré à partir des fichiers `repport/phase1.md` à `repport/phase12.md`. Pour toute évolution ultérieure du dépôt, mettre à jour ce document en même temps que les rapports de phase.*
