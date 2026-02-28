# Phase 1 — Setup du projet

## Objectif
Mettre en place la structure du monorepo et initialiser tous les services.

## Prérequis à vérifier avant de commencer
- [ ] Git installé (`git --version`)
- [ ] Node.js installé (`node --version`) — v18 minimum
- [ ] Docker installé (`docker --version`)
- [ ] Compte GitHub créé
- [ ] Compte Docker Hub créé

## Ce que tu vas faire
1. Créer le repo GitHub
2. Mettre en place la structure des dossiers
3. Initialiser chaque service Node.js
4. Initialiser le front React + Vite
5. Configurer ESLint sur tous les services
6. Créer un docker-compose.yml de base

## Structure attendue à la fin
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
│   └── overlays/
├── helm/
├── jenkins/
├── docs/
├── CONTEXT.md
├── PROGRESS.md
├── docker-compose.yml
└── .gitignore
```

## Questions de compréhension
> Demande à Cursor de te poser ces questions avant de commencer :
- Pourquoi utiliser un monorepo plutôt qu'un repo par service ?
- Quelle est la différence entre `docker-compose` et `Dockerfile` ?
- Pourquoi séparer `k8s/base` et `k8s/overlays` ?

## Critères de validation
- [ ] Repo GitHub créé et cloné en local
- [ ] Structure des dossiers créée
- [ ] `npm init` fait dans chaque service
- [ ] `npm create vite@latest` fait dans `/front`
- [ ] ESLint configuré dans chaque service (`npm init @eslint/config`)
- [ ] `docker-compose.yml` de base avec PostgreSQL, Redis, RabbitMQ
- [ ] `.gitignore` configuré (node_modules, .env, etc.)
- [ ] Premier commit pushé sur GitHub

## Commande pour tester
```bash
docker-compose up -d
docker-compose ps  # tous les services doivent être "Up"
```

## Ressources
- [Monorepo vs Multirepo](https://monorepo.tools/)
- [Docker Compose docs](https://docs.docker.com/compose/)