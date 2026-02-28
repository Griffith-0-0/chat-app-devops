# Chat App — Contexte Projet

## Description
Application de chat temps réel en architecture microservices. Ce projet sert de terrain de pratique DevOps complet, du code au monitoring en production.

## Architecture
Monorepo GitHub avec 3 services backend + 1 front, tous déployés sur Kubernetes via un pipeline CI/CD automatisé.

```
GitHub (monorepo)
    ↓
Jenkins (CI : test + build + docker push)
    ↓
Docker Hub (registry images)
    ↓
Argo CD (GitOps → deploy automatique sur K8s)
    ↓
Kubernetes / Minikube (orchestration)
    ↓
Prometheus + Grafana + Loki (monitoring)
Sentry (erreurs)
AlertManager → Discord (alertes)
```

## Services

| Service | Port | Technos | Responsabilité |
|---------|------|---------|----------------|
| **auth** | 3001 | Node.js, Express, JWT, bcrypt | Register, Login, Logout, Refresh token |
| **messaging** | 3003 | Node.js, Express, Socket.io | Chat temps réel, historique messages |
| **profiles** | 3002 | Node.js, Express | CRUD profil utilisateur |
| **front** | 80 | React, Vite | Interface utilisateur |

## Infrastructure

| Composant | Rôle |
|-----------|------|
| PostgreSQL | BDD principale (une par service) |
| Redis | Sessions, blacklist tokens, rooms actives |
| RabbitMQ | Communication événementielle entre services |
| Nginx | Reverse proxy / API Gateway |

## Stack DevOps complète

| Étape | Outil |
|-------|-------|
| Code | GitHub (monorepo) |
| CI/CD | Jenkins (dans Docker) |
| Registry | Docker Hub |
| Qualité code | ESLint + SonarCloud |
| Tests | Jest + Supertest |
| Conteneurs | Docker + Docker Compose |
| Orchestration | Kubernetes (Minikube en local) |
| Packaging K8s | Helm |
| GitOps | Argo CD |
| Routing | Nginx Ingress Controller |
| Métriques | Prometheus + Grafana |
| Logs | Loki + Promtail |
| Erreurs | Sentry |
| Alertes | AlertManager → Discord |
| Sécurité images | Trivy |
| Sécurité dépendances | Dependabot |
| Secrets | K8s Secrets + Jenkins Credentials |

## Structure du repo

```
chat-app/
├── .cursor/
│   └── rules
├── .github/
│   └── dependabot.yml
├── front/
├── services/
│   ├── auth/
│   ├── messaging/
│   └── profiles/
├── k8s/
│   ├── base/
│   │   ├── auth/
│   │   ├── messaging/
│   │   ├── profiles/
│   │   ├── front/
│   │   ├── postgres/
│   │   ├── redis/
│   │   ├── rabbitmq/
│   │   ├── argocd/
│   │   ├── monitoring/
│   │   ├── network-policies/
│   │   └── ingress.yaml
│   └── overlays/
├── helm/
│   ├── auth/
│   ├── messaging/
│   ├── profiles/
│   └── front/
├── jenkins/
│   └── docker-compose.jenkins.yml
├── nginx/
│   └── nginx.conf
├── docs/
│   ├── PHASE-1.md  → PHASE-12.md
├── Jenkinsfile
├── docker-compose.yml
├── CONTEXT.md
└── PROGRESS.md
```

## Objectif pédagogique
Apprendre le DevOps en pratique sur un projet réel. L'accent est mis sur la **compréhension** de chaque outil et non sur la vitesse d'exécution.