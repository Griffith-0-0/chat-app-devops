# Phase 7 — Kubernetes (Minikube)

## Objectif
Déployer tous les services sur Kubernetes en local avec Minikube, configurer le routing via Nginx Ingress.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre un Pod, un Deployment et un Service dans K8s ?
- Pourquoi utiliser un Deployment plutôt que créer des Pods directement ?
- Qu'est-ce qu'un Ingress et pourquoi en a-t-on besoin ?
- Quelle est la différence entre un ConfigMap et un Secret ?
- Qu'est-ce que `kubectl` ?

---

## 7.1 Setup Minikube

```bash
# Installer Minikube
# https://minikube.sigs.k8s.io/docs/start/

# Démarrer le cluster
minikube start --driver=docker --cpus=4 --memory=6g

# Activer les addons nécessaires
minikube addons enable ingress
minikube addons enable metrics-server

# Vérifier que ça marche
kubectl get nodes
kubectl get pods -A
```

---

## 7.2 Structure des manifests K8s

```
k8s/
├── base/
│   ├── namespace.yaml
│   ├── auth/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── messaging/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── profiles/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── front/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── postgres/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── redis/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── rabbitmq/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ingress.yaml
```

---

## 7.3 Exemples de manifests

### Namespace
```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: chat-app
```

### Deployment (exemple service auth)
```yaml
# k8s/base/auth/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth
  namespace: chat-app
spec:
  replicas: 1
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
          image: ton-username/chat-auth:latest
          ports:
            - containerPort: 3001
          envFrom:
            - configMapRef:
                name: auth-config
            - secretRef:
                name: auth-secrets
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
```

### Service
```yaml
# k8s/base/auth/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: auth
  namespace: chat-app
spec:
  selector:
    app: auth
  ports:
    - port: 3001
      targetPort: 3001
```

### ConfigMap
```yaml
# k8s/base/auth/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-config
  namespace: chat-app
data:
  PORT: "3001"
  DATABASE_URL: "postgresql://user:pass@postgres:5432/auth_db"
  REDIS_URL: "redis://redis:6379"
```

### Secret
```yaml
# k8s/base/auth/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-secrets
  namespace: chat-app
type: Opaque
data:
  JWT_SECRET: <base64_encoded_value>
  JWT_REFRESH_SECRET: <base64_encoded_value>
```
> Encoder en base64 : `echo -n "ma_valeur" | base64`

### Ingress
```yaml
# k8s/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: chat-ingress
  namespace: chat-app
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
spec:
  ingressClassName: nginx
  rules:
    - host: chat-app.local
      http:
        paths:
          - path: /api/auth(/|$)(.*)
            pathType: Prefix
            backend:
              service:
                name: auth
                port:
                  number: 3001
          - path: /api/messages(/|$)(.*)
            pathType: Prefix
            backend:
              service:
                name: messaging
                port:
                  number: 3003
          - path: /api/profiles(/|$)(.*)
            pathType: Prefix
            backend:
              service:
                name: profiles
                port:
                  number: 3002
          - path: /(.*)
            pathType: Prefix
            backend:
              service:
                name: front
                port:
                  number: 80
```

---

## 7.4 Ajouter le host local

```bash
# Récupérer l'IP de Minikube
minikube ip
# Ex: 192.168.49.2

# Ajouter dans /etc/hosts
echo "192.168.49.2 chat-app.local" | sudo tee -a /etc/hosts
```

---

## 7.5 Ajouter des health checks dans chaque service

Chaque service doit exposer une route `/health` :
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth' })
})
```

---

## Commandes utiles
```bash
# Appliquer tous les manifests
kubectl apply -f k8s/base/ -R

# Voir l'état des pods
kubectl get pods -n chat-app

# Voir les logs d'un pod
kubectl logs -f deployment/auth -n chat-app

# Décrire un pod (utile pour débugger)
kubectl describe pod <pod-name> -n chat-app

# Entrer dans un pod
kubectl exec -it deployment/auth -n chat-app -- sh

# Voir les events (utile pour débugger)
kubectl get events -n chat-app --sort-by='.lastTimestamp'
```

---

## Critères de validation
- [ ] Minikube démarre sans erreur
- [ ] Tous les pods sont en état `Running`
- [ ] Les health checks répondent (readiness/liveness probes)
- [ ] L'Ingress route correctement vers les services
- [ ] L'app est accessible sur `http://chat-app.local`
- [ ] Aucun secret n'est en dur dans les ConfigMaps
- [ ] Les données postgres persistent après redémarrage du pod