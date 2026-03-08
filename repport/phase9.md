# Phase 9 — Argo CD (GitOps)

## Définitions

**Outils :**
- **Argo CD** : Opérateur Kubernetes qui synchronise automatiquement l'état du cluster avec un dépôt Git (approche GitOps).
- **GitOps** : Pratique où Git est la source de vérité ; les changements de configuration sont appliqués via des commits, pas des commandes manuelles.
- **argocd CLI** : Interface en ligne de commande pour gérer Argo CD (login, sync, rollback).
- **Application** : Ressource Argo CD qui lie un dépôt Git (path Helm/Kustomize) à un namespace Kubernetes.

**Concepts :**
- **Source of truth** : Le dépôt Git définit l'état désiré ; Argo CD assure que le cluster reflète cet état.
- **Sync** : Argo CD compare l'état Git avec le cluster et applique les différences.
- **selfHeal** : Argo CD corrige automatiquement les modifications manuelles (ex. `kubectl scale`) pour revenir à l'état Git.
- **prune** : Supprime les ressources présentes dans le cluster mais absentes du dépôt Git.
- **Poll** : Argo CD vérifie périodiquement (toutes les 3 min par défaut) les changements dans Git.

**Aspects de la phase :** Déployer automatiquement sur Kubernetes dès qu'un changement est détecté dans le repo Git. Tester le flux GitOps et la self-heal.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

- Installer Argo CD sur Minikube.
- Connecter le dépôt GitHub à Argo CD.
- Créer une Application Argo CD par service (auth, profiles, messaging, front).
- Activer le sync automatique et la self-heal.
- Valider le flux : modification Git → Argo CD détecte → déploiement automatique.
- Valider la self-heal : modification manuelle corrigée automatiquement.

### 1.2 Place dans le flux DevOps

```
GitHub (push helm/*/values.yaml)
        ↓
Argo CD détecte le diff (poll 3 min)
        ↓
Argo CD applique helm upgrade sur K8s
        ↓
Nouveaux pods déployés
```

---

## 2. Étapes et commandes utilisées

### 2.1 Installer Argo CD sur Minikube

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl get pods -n argocd -w
```

Quand tous les pods sont `Running` :

```bash
kubectl port-forward svc/argocd-server -n argocd 8090:443
```

→ Argo CD accessible sur **https://localhost:8090**

### 2.2 Récupérer le mot de passe admin

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

- **Username** : `admin`
- **Password** : (sortie de la commande ci-dessus)

### 2.3 Connecter le repo GitHub

**Via l'UI** (Settings → Repositories → Connect Repo) :
- **Repository URL** : `https://github.com/Griffith-0-0/chat-app-devops`
- Repo public : laisser Username et Password vides

**Via CLI** (si repo public) :
```bash
argocd repo add https://github.com/Griffith-0-0/chat-app-devops
```

### 2.4 Créer les Applications Argo CD

**Via l'UI** (New App) — pour chaque service :

| Application   | Path        | Namespace |
|---------------|-------------|-----------|
| chat-auth     | helm/auth   | chat-app  |
| chat-profiles | helm/profiles | chat-app |
| chat-messaging | helm/messaging | chat-app |
| chat-front    | helm/front  | chat-app  |

Paramètres communs :
- **Project** : default
- **Sync Policy** : Automatic
- **Repository URL** : https://github.com/Griffith-0-0/chat-app-devops
- **Revision** : main
- **Destination** : in-cluster
- **CreateNamespace** : true (pour chat-app)

### 2.5 Prérequis avant sync

L'infrastructure (postgres, redis, rabbitmq) doit être déployée via `kubectl apply` avant que les apps Argo CD ne sync. Argo CD gère uniquement les Helm charts des services applicatifs.

---

## 3. Validation du flux GitOps

### 3.1 Modification de values.yaml et auto-sync

```bash
# Modifier helm/auth/values.yaml (ex. JWT_EXPIRES_IN: "16m")
git add helm/auth/values.yaml
git commit -m "test: change JWT_EXPIRES_IN for Argo CD sync validation"
git push
```

Argo CD détecte le changement (poll ~3 min). Ou forcer : **Refresh** puis **Sync** dans l'UI.

Résultat attendu : chat-auth passe à **OutOfSync** puis **Synced** après application. ConfigMap et pods mis à jour.

---

## 4. Validation de la self-heal

```bash
kubectl scale deployment auth -n chat-app --replicas=2
```

Résultat :
1. chat-auth passe à **OutOfSync** (2 replicas au lieu de 1 défini dans values).
2. Argo CD détecte le drift et resynchronise.
3. chat-auth revient à **Healthy Synced** avec 1 replica.

---

## 5. Commandes utiles

```bash
# Forcer un sync manuel
argocd app sync chat-auth

# Voir le statut d'une app
argocd app get chat-auth

# Historique des déploiements
argocd app history chat-auth

# Rollback via Argo CD
argocd app rollback chat-auth <revision-id>
```

---

## 6. Difficultés rencontrées et solutions

### 6.1 Certificat SSL sur localhost

**Problème :** Le navigateur affiche un avertissement de certificat pour https://localhost:8090.

**Cause :** Argo CD utilise un certificat auto-signé par défaut.

**Solution :** Accepter l'exception de sécurité dans le navigateur (Avancé → Continuer). En production, configurer un certificat valide.

### 6.2 Applications créées via UI

**Note :** Les Applications ont été créées via l'UI Argo CD. Pour une approche GitOps complète, on peut ajouter des manifests dans `k8s/base/argocd/` et les appliquer avec `kubectl apply`, afin que la définition des Applications soit versionnée dans Git.

---

## 7. Synthèse

| Élément | Détail |
|---------|--------|
| Argo CD | Installé dans namespace argocd |
| Repo | https://github.com/Griffith-0-0/chat-app-devops (public) |
| Applications | chat-auth, chat-profiles, chat-messaging, chat-front |
| Sync | Automatique (poll 3 min) |
| selfHeal | Activé — corrections automatiques des drifts manuels |

---

## 8. Critères de validation (Phase 9)

| Critère | Statut |
|---------|--------|
| Argo CD installé et accessible sur https://localhost:8090 | ✅ |
| Repo GitHub connecté à Argo CD | ✅ |
| Application Argo CD créée pour chaque service | ✅ |
| Sync automatique activé | ✅ |
| Modification Git → Argo CD sync automatique | ✅ |
| Modification manuelle corrigée (selfHeal) | ✅ |
| Tous les services en Synced et Healthy | ✅ |
