# Phase 17 — Sécurité (Scan, RBAC, Secrets, Network Policies)

## Objectif
Renforcer la sécurité de la Chat App à plusieurs niveaux : scan de vulnérabilités dans le pipeline CI, RBAC Kubernetes, gestion sécurisée des secrets, et isolation réseau des pods.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre un Role et un ClusterRole dans Kubernetes ?
- Pourquoi ne pas stocker des secrets en clair dans les manifests Git ?
- Qu'est-ce que SOPS ? Comment chiffre-t-il les secrets ?
- Pourquoi les Network Policies sont-elles importantes dans un cluster multi-services ?
- Qu'est-ce que la surface d'attaque d'une image Docker ?

---

## Architecture de sécurité

```
Pipeline Jenkins
    │
    ├── Trivy → scan image avant push
    └── npm audit → scan dépendances

Kubernetes
    ├── RBAC → contrôle des accès par ServiceAccount
    ├── NetworkPolicies → isolation réseau des pods
    └── Secrets chiffrés → SOPS ou External Secrets Operator

Images Docker
    └── utilisateur non-root, image minimale (alpine)
```

---

## 17.1 Scan de vulnérabilités dans le pipeline (Trivy)

Trivy est déjà intégré dans le Jenkinsfile (Phase 6). Cette phase renforce son utilisation.

### Scan des images avant push

```groovy
// Dans Jenkinsfile — stage Trivy existant
stage('Trivy Security Scan') {
    steps {
        script {
            // Bloquer si vulnérabilité CRITICAL ou HIGH
            sh "trivy image --exit-code 1 --severity CRITICAL,HIGH \
                ${DOCKER_HUB_USER}/chat-auth:${BUILD_NUMBER}"
        }
    }
}
```

### Scan des dépendances npm

```groovy
stage('Dependency Audit') {
    steps {
        dir('services/auth') {
            sh 'npm audit --audit-level=high'
        }
        dir('services/profiles') {
            sh 'npm audit --audit-level=high'
        }
        dir('services/messaging') {
            sh 'npm audit --audit-level=high'
        }
    }
}
```

### Scan des manifests Kubernetes (Trivy config)

```bash
# Scanner les manifests K8s pour des problèmes de sécurité
trivy config k8s/base/

# Scanner les charts Helm
trivy config helm/auth/
```

---

## 17.2 RBAC Kubernetes

### Principe des moindres privilèges

Chaque service doit avoir uniquement les permissions nécessaires.

### ServiceAccount par service

```yaml
# k8s/base/auth/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: auth-sa
  namespace: chat-app
```

### Role — permissions limitées

```yaml
# k8s/base/auth/role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: auth-role
  namespace: chat-app
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["auth-secrets"]
    verbs: ["get"]
```

### RoleBinding — lier le Role au ServiceAccount

```yaml
# k8s/base/auth/rolebinding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: auth-rolebinding
  namespace: chat-app
subjects:
  - kind: ServiceAccount
    name: auth-sa
    namespace: chat-app
roleRef:
  kind: Role
  apiGroup: rbac.authorization.k8s.io
  name: auth-role
```

### Référencer le ServiceAccount dans le Deployment

```yaml
# Dans deployment.yaml
spec:
  template:
    spec:
      serviceAccountName: auth-sa
      containers:
        ...
```

### Vérifier les permissions

```bash
# Vérifier ce que peut faire auth-sa
kubectl auth can-i get secrets --as=system:serviceaccount:chat-app:auth-sa -n chat-app

# Lister les RoleBindings
kubectl get rolebindings -n chat-app
```

---

## 17.3 Gestion sécurisée des secrets avec SOPS

SOPS permet de chiffrer les secrets pour les versionner en Git sans exposer les valeurs.

### Installer SOPS

```bash
brew install sops gnupg
```

### Créer une clé GPG

```bash
gpg --batch --generate-key <<EOF
%no-protection
Key-Type: 1
Key-Length: 4096
Subkey-Type: 1
Subkey-Length: 4096
Name-Real: Chat App DevOps
Name-Email: devops@chat-app.local
Expire-Date: 0
EOF
```

### Récupérer l'empreinte GPG

```bash
gpg --list-secret-keys --keyid-format LONG
# Copier l'ID de la clé (après "rsa4096/")
```

### Créer le fichier de config SOPS

```yaml
# .sops.yaml (à la racine du repo)
creation_rules:
  - path_regex: k8s/base/.*/secret\.yaml
    pgp: "VOTRE_EMPREINTE_GPG"
```

### Chiffrer un secret

```bash
# Chiffrer
sops --encrypt k8s/base/auth/secret.yaml > k8s/base/auth/secret.enc.yaml

# Déchiffrer (pour appliquer)
sops --decrypt k8s/base/auth/secret.enc.yaml | kubectl apply -f -
```

### Alternative : External Secrets Operator

```bash
# Installer External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
```

---

## 17.4 Network Policies — Isolation réseau

Par défaut, tous les pods peuvent communiquer entre eux. Les Network Policies restreignent ces communications.

### Policy : Auth ne reçoit que depuis Nginx et Messaging

```yaml
# k8s/base/network-policies/auth-netpol.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-network-policy
  namespace: chat-app
spec:
  podSelector:
    matchLabels:
      app: auth
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: nginx
        - podSelector:
            matchLabels:
              app: messaging
        - podSelector:
            matchLabels:
              app: profiles
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
        - podSelector:
            matchLabels:
              app: redis
    - ports:
        - port: 53   # DNS
          protocol: UDP
```

### Policy : Messaging ne reçoit que depuis Nginx

```yaml
# k8s/base/network-policies/messaging-netpol.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: messaging-network-policy
  namespace: chat-app
spec:
  podSelector:
    matchLabels:
      app: messaging
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: nginx
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
        - podSelector:
            matchLabels:
              app: redis
        - podSelector:
            matchLabels:
              app: rabbitmq
        - podSelector:
            matchLabels:
              app: auth
    - ports:
        - port: 53
          protocol: UDP
```

```bash
# Appliquer les Network Policies
kubectl apply -f k8s/base/network-policies/
```

---

## 17.5 Sécurisation des images Docker

### SecurityContext dans les Deployments

```yaml
# Dans deployment.yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true   # Interdit root
        runAsUser: 1000
        fsGroup: 2000
      containers:
        - name: auth
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
```

### Politique de mise à jour des images

- Utiliser des tags précis (ex. `:42`) plutôt que `:latest` en staging/prod
- Scanner les images régulièrement avec Trivy (cron job ou GitHub Actions)
- Mettre à jour les images de base (node:18-alpine) avec Dependabot

---

## 17.6 Audit des accès Kubernetes

```bash
# Voir qui peut faire quoi dans le namespace chat-app
kubectl auth can-i --list --namespace=chat-app

# Lister tous les ServiceAccounts
kubectl get serviceaccounts -n chat-app

# Voir les secrets accessibles
kubectl get secrets -n chat-app
```

---

## Critères de validation
- [ ] Trivy bloque les images avec vulnérabilités CRITICAL ou HIGH dans Jenkins
- [ ] `npm audit` bloque le pipeline si vulnérabilités high
- [ ] ServiceAccount créé pour chaque service (auth, profiles, messaging)
- [ ] Roles et RoleBindings configurés avec permissions minimales
- [ ] Secrets chiffrés avec SOPS (ou External Secrets Operator configuré)
- [ ] Network Policies créées pour auth, messaging, profiles
- [ ] SecurityContext configuré (non-root, readOnlyRootFilesystem)
- [ ] `trivy config k8s/base/` ne remonte pas de problèmes critiques
