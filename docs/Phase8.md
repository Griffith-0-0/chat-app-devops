# Phase 8 — Helm

## Objectif
Transformer les manifests K8s bruts en Helm charts paramétrables pour faciliter les déploiements et les mises à jour de tags d'images.

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
│       └── secret.yaml
├── messaging/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
├── profiles/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
└── front/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
```

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
  repository: ton-username/chat-auth
  tag: latest
  pullPolicy: Always

service:
  port: 3001

env:
  PORT: "3001"
  DATABASE_URL: "postgresql://user:pass@postgres:5432/auth_db"
  REDIS_URL: "redis://redis:6379"

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

readinessProbe:
  path: /health
  port: 3001

livenessProbe:
  path: /health
  port: 3001
```

### `templates/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
  namespace: chat-app
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
    spec:
      containers:
        - name: {{ .Release.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.port }}
          envFrom:
            - configMapRef:
                name: {{ .Release.Name }}-config
            - secretRef:
                name: {{ .Release.Name }}-secrets
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          readinessProbe:
            httpGet:
              path: {{ .Values.readinessProbe.path }}
              port: {{ .Values.readinessProbe.port }}
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: {{ .Values.livenessProbe.path }}
              port: {{ .Values.livenessProbe.port }}
            initialDelaySeconds: 30
            periodSeconds: 10
```

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
helm lint helm/auth/

# Voir ce qui serait déployé (dry-run)
helm install auth helm/auth/ --dry-run --debug -n chat-app

# Déployer ou mettre à jour
helm upgrade --install auth helm/auth/ -n chat-app

# Voir les releases Helm
helm list -n chat-app

# Rollback vers la version précédente
helm rollback auth 1 -n chat-app

# Supprimer une release
helm uninstall auth -n chat-app
```

---

## Critères de validation
- [ ] Helm chart créé pour les 4 services
- [ ] `helm lint` passe sans erreur sur chaque chart
- [ ] Déploiement via `helm upgrade --install` fonctionne
- [ ] Changer le tag dans `values.yaml` + redéployer → nouvelle image utilisée
- [ ] `helm rollback` fonctionne (tester un rollback)
- [ ] Les ressources CPU/mémoire sont définies dans `values.yaml`