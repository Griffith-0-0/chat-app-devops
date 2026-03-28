# Phase 13 — Multi-environnements (dev / staging / prod)

## Objectif
Mettre en place plusieurs environnements distincts (dev, staging, prod) avec des configurations différenciées, gérés via Kustomize overlays et Argo CD par environnement.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre dev, staging et prod ?
- Pourquoi ne pas déployer directement en prod depuis la branche main ?
- Qu'est-ce que Kustomize ? En quoi complète-t-il Helm ?
- Comment Argo CD gère-t-il plusieurs environnements ?
- Qu'est-ce qu'un Argo CD Project ?

---

## Architecture multi-environnements

```
GitHub (branches)
    main    → prod
    staging → staging
    dev     → dev

Argo CD Projects :
    chat-app-dev     → namespace chat-app-dev
    chat-app-staging → namespace chat-app-staging
    chat-app-prod    → namespace chat-app-prod
```

---

## 13.1 Structure Helm overlays

Créer des fichiers `values-<env>.yaml` par service pour surcharger les valeurs par environnement :

```
helm/
├── auth/
│   ├── Chart.yaml
│   ├── values.yaml            ← valeurs par défaut (dev)
│   ├── values-staging.yaml    ← overrides staging
│   └── values-prod.yaml       ← overrides prod
├── profiles/
│   ├── values.yaml
│   ├── values-staging.yaml
│   └── values-prod.yaml
...
```

### Exemple `values-staging.yaml`
```yaml
# helm/auth/values-staging.yaml
replicaCount: 2

resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "400m"
```

### Exemple `values-prod.yaml`
```yaml
# helm/auth/values-prod.yaml
replicaCount: 3

resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

---

## 13.2 Namespaces par environnement

Créer un namespace par environnement :

```bash
kubectl create namespace chat-app-dev
kubectl create namespace chat-app-staging
kubectl create namespace chat-app-prod
```

Ou déclarer dans des fichiers YAML :

```yaml
# k8s/base/namespaces.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: chat-app-dev
---
apiVersion: v1
kind: Namespace
metadata:
  name: chat-app-staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: chat-app-prod
```

---

## 13.3 Argo CD — Projects et Applications par environnement

### Créer un Project Argo CD par environnement

```yaml
# k8s/base/argocd/project-staging.yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: chat-app-staging
  namespace: argocd
spec:
  description: Environnement staging
  sourceRepos:
    - https://github.com/Griffith-0-0/chat-app-devops
  destinations:
    - namespace: chat-app-staging
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
```

### Application Argo CD avec values-staging.yaml

```yaml
# k8s/base/argocd/auth-staging.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: chat-auth-staging
  namespace: argocd
spec:
  project: chat-app-staging
  source:
    repoURL: https://github.com/Griffith-0-0/chat-app-devops
    targetRevision: staging
    path: helm/auth
    helm:
      valueFiles:
        - values.yaml
        - values-staging.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: chat-app-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

```bash
# Appliquer les projets et applications
kubectl apply -f k8s/base/argocd/
```

---

## 13.4 Déploiement par environnement (Helm CLI)

```bash
# Dev
helm upgrade --install auth helm/auth \
  -n chat-app-dev --create-namespace \
  -f helm/auth/values.yaml

# Staging
helm upgrade --install auth helm/auth \
  -n chat-app-staging --create-namespace \
  -f helm/auth/values.yaml \
  -f helm/auth/values-staging.yaml

# Prod
helm upgrade --install auth helm/auth \
  -n chat-app-prod --create-namespace \
  -f helm/auth/values.yaml \
  -f helm/auth/values-prod.yaml
```

---

## 13.5 Variables d'environnement différenciées

Ajouter dans les `values-<env>.yaml` les variables spécifiques à chaque env :

```yaml
# values-prod.yaml
env:
  PORT: "3001"
  DATABASE_URL: "postgresql://user:pass@postgres:5432/chat_db_prod"
  REDIS_URL: "redis://redis:6379"
  JWT_EXPIRES_IN: "10m"
  JWT_REFRESH_EXPIRES_IN: "1d"
```

---

## 13.6 Vérification

```bash
# Voir les pods par environnement
kubectl get pods -n chat-app-dev
kubectl get pods -n chat-app-staging
kubectl get pods -n chat-app-prod

# Voir les Applications Argo CD
kubectl get applications -n argocd
```

---

## Critères de validation
- [ ] Fichiers `values-staging.yaml` et `values-prod.yaml` créés pour chaque service
- [ ] Namespaces chat-app-dev, chat-app-staging, chat-app-prod créés
- [ ] Argo CD Projects créés pour staging et prod
- [ ] Applications Argo CD créées par service et par environnement
- [ ] Déploiement staging différent du dev (plus de réplicas, plus de ressources)
- [ ] Les trois environnements coexistent dans le cluster sans conflit
