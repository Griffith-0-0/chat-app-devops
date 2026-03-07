# Phase 8 — Helm

## Objectif
Transformer les manifests K8s bruts en Helm charts paramétrables pour faciliter les déploiements et les mises à jour de tags d'images. Les charts gèrent uniquement les services applicatifs (auth, profiles, messaging, front) ; l'infrastructure (Postgres, Redis, RabbitMQ, nginx) reste en manifests K8s.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre des manifests K8s bruts et un Helm chart ?
- Qu'est-ce qu'un `values.yaml` dans Helm ?
- Pourquoi Jenkins modifie le `values.yaml` plutôt que le Deployment directement ?
- Qu'est-ce que `helm upgrade --install` ?

---

## Structure attendue

```
helm/
├── auth/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── configmap.yaml
│       └── secret.yaml          # Seul auth a un Secret (JWT_SECRET, JWT_REFRESH_SECRET)
├── profiles/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── configmap.yaml
├── messaging/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── configmap.yaml
└── front/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── deployment.yaml
        └── service.yaml         # Pas de ConfigMap (config VITE_* au build)
```

### Différences entre les charts

| Service   | Secret | ConfigMap | Probes | Port |
|-----------|--------|-----------|--------|------|
| **auth**  | Oui | Oui | readiness + liveness | 3001 |
| **profiles** | Non | Oui (PORT, DATABASE_URL, AUTH_SERVICE_URL) | Oui | 3002 |
| **messaging** | Non | Oui (+ REDIS_URL, RABBITMQ_URL) | Oui | 3003 |
| **front** | Non | Non | Non | 80 |

---

## Exemple — Helm chart du service Auth

### `Chart.yaml`
```yaml
apiVersion: v2
name: chat-auth
description: Auth service for Chat App
type: application
version: 0.1.0
appVersion: "1.0.0"
```

### `values.yaml`
```yaml
replicaCount: 1

image:
  repository: badrkhafif98/chat-auth
  tag: latest
  pullPolicy: Never

service:
  port: 3001

env:
  PORT: "3001"
  DATABASE_URL: "postgresql://user:password@postgres:5432/chat_db"
  REDIS_URL: "redis://redis:6379"
  JWT_EXPIRES_IN: "15m"
  JWT_REFRESH_EXPIRES_IN: "7d"

secrets:
  JWT_SECRET: ""
  JWT_REFRESH_SECRET: ""

resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

> `pullPolicy: Never` en dev local (images chargées via `minikube image load`). En prod, utiliser `Always` ou `IfNotPresent`.

### `templates/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth
  namespace: chat-app
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: auth
  template:
    metadata:
      labels:
        app: auth
    spec:
      containers:
        - name: auth
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.port }}
          envFrom:
            - configMapRef:
                name: auth-config
            - secretRef:
                name: auth-secrets
          readinessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.port }}
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.port }}
            initialDelaySeconds: 30
            periodSeconds: 10
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

### `templates/secret.yaml` (auth uniquement)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-secrets
  namespace: chat-app
type: Opaque
data:
  JWT_SECRET: {{ .Values.secrets.JWT_SECRET | b64enc | quote }}
  JWT_REFRESH_SECRET: {{ .Values.secrets.JWT_REFRESH_SECRET | b64enc | quote }}
```

---

## Ordre de déploiement

1. **Infrastructure** (manifests K8s, pas Helm) :
   ```bash
   kubectl apply -f k8s/base/postgres/ -n chat-app
   kubectl apply -f k8s/base/redis/ -n chat-app
   kubectl apply -f k8s/base/rabbitmq/ -n chat-app
   ```
2. **Services applicatifs** (Helm) :
   ```bash
   helm install auth helm/auth -n chat-app --create-namespace \
     --set secrets.JWT_SECRET=xxx --set secrets.JWT_REFRESH_SECRET=xxx
   helm install profiles helm/profiles -n chat-app
   helm install messaging helm/messaging -n chat-app
   helm install front helm/front -n chat-app
   ```

> **Important** : Si des ressources existaient déjà via `kubectl apply`, supprimer le namespace avant d'installer avec Helm : `kubectl delete namespace chat-app`

---

## Comment Jenkins met à jour le tag

Dans le Jenkinsfile (Phase 6), le stage `Update Helm Values` fait :
```bash
# Remplacer le tag dans values.yaml
sed -i "s/tag: .*/tag: ${BUILD_NUMBER}/" helm/auth/values.yaml

# Commit et push → Argo CD détecte le changement
git add helm/auth/values.yaml
git commit -m "ci: update auth image tag to ${BUILD_NUMBER} [skip ci]"
git push
```

> [skip ci] dans le message de commit évite de déclencher un nouveau pipeline Jenkins.

---

## Commandes Helm utiles
```bash
# Vérifier la syntaxe du chart sans déployer
helm lint helm/auth helm/profiles helm/messaging helm/front

# Voir ce qui serait déployé (dry-run)
helm install auth helm/auth/ --dry-run --debug -n chat-app

# Installer ou mettre à jour
helm upgrade --install auth helm/auth/ -n chat-app
helm upgrade auth helm/auth/ -n chat-app --set image.tag=v2

# Appliquer les ressources CPU/mémoire (après modification de values.yaml)
helm upgrade auth helm/auth/ -n chat-app

# Voir les releases Helm
helm list -n chat-app
helm history auth -n chat-app

# Rollback vers une révision précédente
helm rollback auth 1 -n chat-app

# Vérifier l'image utilisée par un pod
kubectl get pods -n chat-app -l app=auth -o jsonpath='{.items[0].spec.containers[0].image}'

# Supprimer une release
helm uninstall auth -n chat-app
```

---

## Difficultés courantes

| Problème | Cause | Solution |
|----------|-------|----------|
| `cluster reachability check failed` | Minikube non démarré | `minikube start` |
| `Service "front" exists... cannot be imported` | Ressources créées avec kubectl | `kubectl delete namespace chat-app` puis réinstaller avec Helm |
| Messaging en CrashLoopBackOff | RabbitMQ non déployé | Déployer postgres, redis, rabbitmq avant messaging. Ou `kubectl delete pod -l app=messaging` une fois l'infra prête. |
| QoS BestEffort, resources = {} | Pod déployé avant ajout des resources | `helm upgrade` pour appliquer la nouvelle config |

---

## Critères de validation
- [ ] Helm chart créé pour les 4 services
- [ ] `helm lint` passe sans erreur sur chaque chart
- [ ] Déploiement via `helm upgrade --install` fonctionne
- [ ] Changer le tag + `helm upgrade` → nouvelle image utilisée
- [ ] `helm rollback` fonctionne
- [ ] Ressources CPU/mémoire définies dans `values.yaml` et appliquées (QoS Burstable)