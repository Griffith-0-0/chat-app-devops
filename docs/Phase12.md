# Phase 12 — Sécurité

## Objectif
Appliquer les bonnes pratiques de sécurité DevOps : gestion des secrets, scan des images, isolation réseau entre services.

---

## Questions de compréhension avant de commencer
- Pourquoi ne jamais mettre un secret dans un ConfigMap ?
- Qu'est-ce qu'une Network Policy K8s et pourquoi c'est important ?
- Qu'est-ce que le "principe du moindre privilège" appliqué à K8s ?
- Pourquoi scanner les images Docker régulièrement et pas juste au build ?

---

## 12.1 Audit des secrets

### Vérifier qu'aucun secret n'est en clair dans le code
```bash
# Scanner le repo pour trouver des secrets accidentels
# Installer git-secrets ou truffleHog
npx trufflesecurity/trufflehog git file://. --only-verified

# Vérifier qu'aucune clé n'est dans les fichiers committés
git log --all --full-history -- "**/.env"
```

### Checklist secrets
- [ ] Aucun `.env` commité (vérifier `.gitignore`)
- [ ] Tous les secrets K8s sont dans des `Secret` objects (pas `ConfigMap`)
- [ ] Les credentials Jenkins sont dans "Jenkins Credentials" (pas dans le Jenkinsfile)
- [ ] Aucun token/password en dur dans le code source

### Encoder correctement les K8s Secrets
```bash
# Encoder une valeur
echo -n "mon_secret_jwt" | base64

# Vérifier qu'un secret est bien créé
kubectl get secret auth-secrets -n chat-app -o yaml

# Décoder pour vérifier (en local seulement !)
kubectl get secret auth-secrets -n chat-app \
  -o jsonpath='{.data.JWT_SECRET}' | base64 -d
```

---

## 12.2 Network Policies

Par défaut dans K8s, tous les pods peuvent se parler. Les Network Policies permettent de contrôler ça.

### Politique recommandée pour ce projet

```yaml
# k8s/base/network-policies/default-deny.yaml
# Bloquer tout le trafic par défaut dans le namespace chat-app
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: chat-app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

```yaml
# k8s/base/network-policies/allow-front-to-services.yaml
# Le front peut appeler les services via Nginx
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-services
  namespace: chat-app
spec:
  podSelector:
    matchLabels:
      app: auth
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
```

```yaml
# k8s/base/network-policies/allow-services-to-db.yaml
# Les services peuvent accéder à PostgreSQL et Redis
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-services-to-postgres
  namespace: chat-app
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchExpressions:
              - key: app
                operator: In
                values: [auth, messaging, profiles]
      ports:
        - port: 5432
```

> ⚠️ Activer Minikube avec le CNI qui supporte les Network Policies :
> `minikube start --cni=calico`

---

## 12.3 Security Context dans les Deployments

Ajouter dans chaque `deployment.yaml` (ou `values.yaml` Helm) :

```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
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

---

## 12.4 Trivy — scan continu des images

Trivy est déjà dans le pipeline Jenkins. Ajouter aussi un scan planifié :

```yaml
# k8s/base/monitoring/trivy-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: trivy-scan
  namespace: chat-app
spec:
  schedule: "0 2 * * *"  # Chaque nuit à 2h
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: trivy
              image: aquasec/trivy:latest
              command:
                - trivy
                - image
                - --severity=HIGH,CRITICAL
                - --exit-code=0
                - ton-username/chat-auth:latest
          restartPolicy: OnFailure
```

---

## 12.5 RBAC (Role-Based Access Control)

Limiter ce que Jenkins peut faire sur le cluster :

```yaml
# k8s/base/rbac/jenkins-sa.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jenkins
  namespace: chat-app
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: jenkins-role
  namespace: chat-app
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "update", "patch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jenkins-rolebinding
  namespace: chat-app
subjects:
  - kind: ServiceAccount
    name: jenkins
roleRef:
  kind: Role
  name: jenkins-role
  apiGroup: rbac.authorization.k8s.io
```

---

## Critères de validation
- [ ] Aucun secret en clair dans le code ou les ConfigMaps
- [ ] `.env` dans `.gitignore` et aucun `.env` commité
- [ ] Network Policies appliquées — le front ne peut pas parler directement à PostgreSQL
- [ ] `securityContext` configuré sur tous les Deployments (runAsNonRoot)
- [ ] Trivy scan dans le pipeline Jenkins bloque les vulnérabilités critiques
- [ ] RBAC configuré pour Jenkins
- [ ] Tester la Network Policy : `kubectl exec` depuis le pod front et essayer de ping postgres → doit échouer