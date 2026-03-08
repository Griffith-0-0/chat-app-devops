# Progression TP DevOps — Chat App

## Statut global
🟢 Phase 9 terminée — Argo CD GitOps opérationnel

---

## Phases

| Phase | Description | Statut |
|-------|-------------|--------|
| Phase 1 | Setup monorepo | ✅ |
| Phase 2 | Développement services | ✅ |
| Phase 3 | Containerisation Docker | ✅ |
| Phase 4 | Tests Jest + Supertest | ✅ |
| Phase 5 | Qualité code SonarCloud | ✅ |
| Phase 6 | Pipeline Jenkins | ✅ |
| Phase 7 | Kubernetes Minikube | ✅ |
| Phase 8 | Helm charts | ✅ |
| Phase 9 | Argo CD GitOps | ✅ |
| Phase 10 | Monitoring Prometheus + Grafana + Loki | 🔴 |
| Phase 11 | Alerting AlertManager | 🔴 |
| Phase 12 | Sécurité | 🔴 |

---

## ✅ Terminé
<!-- Ajouter ici ce qui est fait -->
Phase 1 terminée ✅------------------------------------------------
Voici ce que tu as accompli :
Étape	                                        Statut
Repo GitHub créé et cloné	                    ✅
Structure des dossiers	                        ✅
.gitignore configuré	                        ✅
npm init sur les 3 services	                    ✅
Front React + Vite initialisé	                ✅
ESLint sur les 3 services	                    ✅
docker-compose.yml (postgres, redis, rabbitmq)	✅
Premier commit pushé sur GitHub	                ✅

Phase 2 terminée ✅------------------------------------------------
Étape	                                                    Statut
Service auth (register, login, logout, refresh, verify)	    ✅
Service profiles (GET, PUT avec auth)	                    ✅
Service messaging (Socket.io, historique messages)	        ✅
Front React (login, register, chat, profil)	                ✅
Communication inter-services (auth/verify)	                ✅
Chat temps réel entre 2 onglets	                            ✅
Commit pushé sur GitHub	                                    ✅

Phase 3 terminée ✅------------------------------------------------
Étape	                                                        Statut
Dockerfile service auth (node:18-alpine, non-root user)	        ✅
Dockerfile service profiles	                                    ✅
Dockerfile service messaging (retry RabbitMQ)	                ✅
Dockerfile front (multi-stage build Vite → Nginx)	            ✅
.dockerignore sur tous les services	                            ✅
nginx.conf (reverse proxy, WebSocket, API Gateway)	            ✅
docker-compose.yml complet (tous les services)	                ✅
Variables VITE_* via ARG/ENV dans le Dockerfile	                ✅
App complète accessible sur http://localhost	                ✅
Commit pushé sur GitHub	                                        ✅

Phase 4 terminée ✅------------------------------------------------
Tests unitaires auth (hash, jwt, validate)	                    ✅
Tests d'intégration auth (register, login, health)	            ✅
Tests d'intégration profiles (GET, PUT, auth, 401/403)	        ✅
Tests d'intégration messaging (GET messages, auth, 401)	        ✅
Mock axios pour authMiddleware (profiles, messaging)	        ✅

Phase 5 terminée ✅------------------------------------------------
SonarCloud (3 projets auth, profiles, messaging)              ✅
sonar-project.properties par service (host, organization)      ✅
Quality Gate Sonar way (built-in)                              ✅
Workflow GitHub Actions (Postgres, Redis, init-db)             ✅
scripts/init-db.sql (users, profiles, messages)                ✅
Dependabot (npm auth, profiles, messaging, front)              ✅
ESLint + lint:fix sur les 3 services                           ✅
Rapport SonarCloud visible sur sonarcloud.io                   ✅

Phase 6 terminée ✅------------------------------------------------
Jenkinsfile complet (Checkout, Detect Changed Services, Install & Lint, Tests, SonarCloud, Docker Build, Trivy, Docker Push)  ✅
Image Jenkins Docker (Node.js 20, Docker CLI, Trivy, SonarScanner)  ✅
jenkins/docker-compose.jenkins.yml + Dockerfile                   ✅
Pipeline du début à la fin sur main                                ✅

Phase 7 terminée ✅------------------------------------------------
Manifests K8s (k8s/base/), Minikube, Ingress, nginx API Gateway      ✅
Postgres (StatefulSet), Redis, RabbitMQ                              ✅
Déploiement auth, profiles, messaging, front                         ✅
App accessible sur http://chat-app.local (minikube tunnel)           ✅
Rapport détaillé → repport/phase7.md                                 ✅

Phase 8 terminée ✅------------------------------------------------
Helm charts auth, profiles, messaging, front                         ✅
helm lint OK, resources CPU/mémoire (QoS Burstable)                  ✅
Changement de tag + helm upgrade + helm rollback validés             ✅
Rapport détaillé → repport/phase8.md                                 ✅

Phase 9 terminée ✅------------------------------------------------
Argo CD installé sur Minikube                                        ✅
Repo GitHub connecté (chat-app-devops, public)                       ✅
Applications chat-auth, chat-profiles, chat-messaging, chat-front    ✅
Sync auto + selfHeal validés (modif Git, kubectl scale)              ✅
Rapport détaillé → repport/phase9.md                                 ✅

Points bloquants et solutions (Phase 6) :
| Problème | Solution |
|----------|----------|
| Dependencies lock file not found | Retirer `cache: 'npm'` de setup-node (monorepo sans package-lock à la racine) |
| Connection refused localhost:9000 | Ajouter `sonar.host.url=https://sonarcloud.io` dans sonar-project.properties |
| sonar.organization manquant | Ajouter `sonar.organization=griffith-0-0` dans chaque sonar-project.properties |
| Tables absentes en CI | Créer scripts/init-db.sql + étape Init database (psql) avant les tests |
| profiles.id sans DEFAULT | Ajouter `DEFAULT gen_random_uuid()` sur id dans table profiles |
| Dependabot Docker erreur | Désactiver la section docker dans dependabot.yml (optionnel) |


## 🔄 En cours
<!-- Ajouter ici la phase en cours et ce qui reste -->

## ❌ Bloqué
<!-- Décrire les blocages avec ce qui a déjà été essayé -->

---

## Difficultés Jenkins workflow

| Problème | Solution |
|----------|----------|
| ESLint `'err' is defined but never used` (no-unused-vars) | Renommer `catch (err)` en `catch (_err)` dans auth, profiles, messaging. Ajouter `caughtErrorsIgnorePattern: '^_'` dans ESLint. |
| ESLint `'process'` / `'Buffer'` is not defined (no-undef) | Remplacer `globals.browser` par `globals.node` + `globals.jest` dans eslint.config.mjs (profiles, messaging). |
| SonarCloud : `The folder 'services/auth/tests' does not exist` | Jenkins-in-Docker : `docker run -v $PWD` monte un chemin inexistant sur l'hôte. Exécuter sonar-scanner directement (sans docker run). |
| SonarCloud : `The folder 'services/auth/src' does not exist` | Même cause. Exécuter `sonar-scanner` en natif depuis chaque service : `(cd services/auth && sonar-scanner)`. |
| `sonar-scanner: not found` | Ajouter `npm install -g sonar-scanner` avant les appels dans le Jenkinsfile. |
| `cd` en cascade échoue après une erreur | Utiliser des subshells : `(cd services/auth && sonar-scanner)` pour isoler chaque `cd`. |
| SonarCloud : `sonar.tests` provoque des erreurs | Supprimer `sonar.tests` des sonar-project.properties. |

---

## 📝 Questions à creuser
<!-- Notes personnelles sur des concepts à mieux comprendre -->

## 💡 Apprentissages clés
<!-- Ce que tu as appris et que tu ne veux pas oublier -->