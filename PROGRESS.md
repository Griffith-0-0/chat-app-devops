# Progression TP DevOps — Chat App

## Statut global
🟢 Phase 5 terminée — Phase 6 (Jenkins) à venir

---

## Phases

| Phase | Description | Statut |
|-------|-------------|--------|
| Phase 1 | Setup monorepo | ✅ |
| Phase 2 | Développement services | ✅ |
| Phase 3 | Containerisation Docker | ✅ |
| Phase 4 | Tests Jest + Supertest | ✅ |
| Phase 5 | Qualité code SonarCloud | ✅ |
| Phase 6 | Pipeline Jenkins | 🔴 |
| Phase 7 | Kubernetes Minikube | 🔴 |
| Phase 8 | Helm charts | 🔴 |
| Phase 9 | Argo CD GitOps | 🔴 |
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

Points bloquants et solutions :
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
| ESLint `'err' is defined but never used` (no-unused-vars) | Renommer `catch (err)` en `catch (_err)` dans les blocs où la variable n'est pas utilisée (verifyToken.js, auth.js). Le pattern `caughtErrorsIgnorePattern: '^_'` dans ESLint accepte les variables préfixées par `_`. |
| SonarCloud : `The folder 'services/auth/tests' does not exist` | Rendre `sonar.tests` conditionnel dans le Jenkinsfile : ne passer `-Dsonar.tests=services/X/tests` que si le dossier existe (`[ -d "services/auth/tests" ] && AUTH_TESTS="..."`). Évite l'échec si le checkout Jenkins n'inclut pas les tests ou si la structure diffère. |

---

## 📝 Questions à creuser
<!-- Notes personnelles sur des concepts à mieux comprendre -->

## 💡 Apprentissages clés
<!-- Ce que tu as appris et que tu ne veux pas oublier -->