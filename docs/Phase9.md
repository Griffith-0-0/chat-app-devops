# Phase 9 — Argo CD (GitOps)

## Objectif
Mettre en place Argo CD pour que les déploiements sur Kubernetes se fassent automatiquement dès qu'un changement est détecté dans le repo Git (les values.yaml Helm mis à jour par Jenkins).

---

## Questions de compréhension avant de commencer
- Qu'est-ce que le GitOps ? Quelle est la différence avec le CI/CD classique ?
- Quel est le rôle d'Argo CD dans notre pipeline ?
- Qu'est-ce que la "source of truth" dans une approche GitOps ?
- Que se passe-t-il si quelqu'un modifie un pod manuellement avec `kubectl` quand Argo CD est actif ?

---

## Le flux GitOps complet

```
Jenkins push → helm/auth/values.yaml (nouveau tag)
                        ↓
              GitHub repo mis à jour
                        ↓
              Argo CD détecte le diff (poll toutes les 3 min)
                        ↓
              Argo CD applique le nouveau Helm chart sur K8s
                        ↓
              Nouveau pod déployé avec la nouvelle image
```

---

## 9.1 Installer Argo CD sur Minikube

```bash
# Créer le namespace
kubectl create namespace argocd

# Installer Argo CD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Vérifier que les pods démarrent
kubectl get pods -n argocd

# Exposer l'UI en local
kubectl port-forward svc/argocd-server -n argocd 8090:443
# Argo CD accessible sur https://localhost:8090
```

### Récupérer le mot de passe admin initial
```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

---

## 9.2 Connecter Argo CD au repo GitHub

### Via l'UI (https://localhost:8090)
1. Settings → Repositories → Connect Repo
2. Type : HTTPS
3. URL : `https://github.com/ton-username/chat-app`
4. Si repo privé : ajouter un Personal Access Token GitHub

### Via CLI
```bash
# Installer argocd CLI
# https://argo-cd.readthedocs.io/en/stable/cli_installation/

argocd login localhost:8090 --insecure
argocd repo add https://github.com/ton-username/chat-app \
  --username ton-username \
  --password ton-github-token
```

---

## 9.3 Créer une Application Argo CD par service

### Via manifests (approche recommandée — GitOps jusqu'au bout)

Créer `k8s/base/argocd/` avec un fichier par service :

```yaml
# k8s/base/argocd/auth-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: chat-auth
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/ton-username/chat-app
    targetRevision: main
    path: helm/auth
  destination:
    server: https://kubernetes.default.svc
    namespace: chat-app
  syncPolicy:
    automated:
      prune: true       # Supprime les ressources qui ne sont plus dans Git
      selfHeal: true    # Corrige les drifts manuels automatiquement
    syncOptions:
      - CreateNamespace=true
```

```bash
# Appliquer les Applications Argo CD
kubectl apply -f k8s/base/argocd/ -n argocd
```

---

## 9.4 Tester le flux complet

1. Modifier une ligne de code dans `services/auth/`
2. Push sur `main`
3. Observer Jenkins qui se déclenche
4. Jenkins met à jour `helm/auth/values.yaml` avec le nouveau tag
5. Argo CD détecte le changement dans Git
6. Argo CD déploie automatiquement la nouvelle version
7. Vérifier dans l'UI Argo CD que le sync est passé au vert

```bash
# Forcer un sync manuel si besoin
argocd app sync chat-auth

# Voir le statut
argocd app get chat-auth

# Voir l'historique des déploiements
argocd app history chat-auth
```

---

## 9.5 Rollback avec Argo CD

```bash
# Lister les révisions
argocd app history chat-auth

# Rollback vers une révision précédente
argocd app rollback chat-auth <revision-id>
```

---

## Critères de validation
- [ ] Argo CD installé et accessible sur https://localhost:8090
- [ ] Repo GitHub connecté à Argo CD
- [ ] Application Argo CD créée pour chaque service
- [ ] Sync automatique activé (`automated`)
- [ ] Flux complet testé : push code → Jenkins → Git update → Argo CD → K8s deploy
- [ ] Modification manuelle d'un pod corrigée automatiquement par Argo CD (selfHeal)
- [ ] Rollback testé via Argo CD
- [ ] Tous les services sont en statut `Synced` et `Healthy` dans l'UI