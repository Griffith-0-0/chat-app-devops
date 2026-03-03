# Progression TP DevOps — Chat App

## Statut global
🔴 Non commencé

---

## Phases

| Phase | Description | Statut |
|-------|-------------|--------|
| Phase 1 | Setup monorepo | ✅ |
| Phase 2 | Développement services | ✅ |
| Phase 3 | Containerisation Docker | ✅ |
| Phase 4 | Tests Jest + Supertest | ✅ |
| Phase 5 | Qualité code SonarCloud | 🔴 |
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
Voici ce que tu as accompli :
Étape	                                                    Statut
Service auth (register, login, logout, refresh, verify)	    ✅
Service profiles (GET, PUT avec auth)	                    ✅
Service messaging (Socket.io, historique messages)	        ✅
Front React (login, register, chat, profil)	                ✅
Communication inter-services (auth/verify)	                ✅
Chat temps réel entre 2 onglets	                            ✅
Commit pushé sur GitHub	                                    ✅

Phase 3 terminée ✅------------------------------------------------
Voici ce que tu as accompli :
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


## 🔄 En cours
<!-- Ajouter ici la phase en cours et ce qui reste -->

## ❌ Bloqué
<!-- Décrire les blocages avec ce qui a déjà été essayé -->

## 📝 Questions à creuser
<!-- Notes personnelles sur des concepts à mieux comprendre -->

## 💡 Apprentissages clés
<!-- Ce que tu as appris et que tu ne veux pas oublier -->