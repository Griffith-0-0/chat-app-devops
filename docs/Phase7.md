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
k8s/base/
├── namespace.yaml           # Namespace chat-app
├── ingress.yaml             # Ingress → nginx (point d'entrée unique)
├── nginx/                   # API Gateway (reverse proxy interne)
│   ├── configmap.yaml       # Configuration nginx.conf
│   ├── deployment.yaml
│   └── service.yaml
├── auth/
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── profiles/
│   ├── configmap.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── messaging/
│   ├── configmap.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── front/
│   ├── deployment.yaml
│   └── service.yaml
├── postgres/
│   ├── statefulset.yaml     # Volume persistant via volumeClaimTemplates
│   └── service.yaml
├── redis/
│   ├── deployment.yaml
│   └── service.yaml
└── rabbitmq/
    ├── deployment.yaml
    └── service.yaml
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
          imagePullPolicy: Never   # En dev local : utiliser l'image chargée dans Minikube
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
  DATABASE_URL: "postgresql://user:password@postgres:5432/chat_db"
  REDIS_URL: "redis://redis:6379"
  JWT_EXPIRES_IN: "15m"
  JWT_REFRESH_EXPIRES_IN: "7d"
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

### Nginx — API Gateway

L'Ingress Minikube n'accepte pas les chemins regex ni `configuration-snippet`. On déploie donc un service **nginx** interne qui fait le routage (comme dans docker-compose).

**ConfigMap nginx** : Contient `nginx.conf` avec les locations `/api/auth/`, `/api/profiles/`, `/api/messages/`, `/socket.io/`, `/`.

**Deployment + Service nginx** : Conteneur `nginx:alpine` avec le ConfigMap monté.

### Ingress (point d'entrée unique → nginx)
```yaml
# k8s/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: chat-ingress
  namespace: chat-app
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
spec:
  ingressClassName: nginx
  rules:
    - host: chat-app.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nginx
                port:
                  number: 80
```

---

## 7.4 Exposer l'accès (minikube tunnel + /etc/hosts)

Avec le driver Docker, l'IP Minikube n'est pas routable depuis l'hôte. Il faut utiliser **minikube tunnel**.

**1. Lancer le tunnel** (garder le terminal ouvert) :
```bash
minikube tunnel
# Entrer le mot de passe sudo si demandé
```

**2. Configurer /etc/hosts** (avec `127.0.0.1`, pas l'IP Minikube) :
```bash
sudo sed -i '' '/chat-app.local/d' /etc/hosts
echo "127.0.0.1 chat-app.local" | sudo tee -a /etc/hosts
```

---

## 7.5 Construire et charger les images (dev local)

Les images doivent être présentes dans Minikube. Méthode recommandée :

```bash
# Construire directement dans Minikube
minikube image build -t ton-username/chat-auth:latest ./services/auth
minikube image build -t ton-username/chat-profiles:latest ./services/profiles
minikube image build -t ton-username/chat-messaging:latest ./services/messaging

# Front : build avec les bonnes URLs
docker build -t ton-username/chat-front:latest \
  --build-arg VITE_AUTH_URL=http://chat-app.local/api \
  --build-arg VITE_PROFILES_URL=http://chat-app.local/api \
  --build-arg VITE_SOCKET_URL=http://chat-app.local \
  --build-arg VITE_API_URL=http://chat-app.local/api \
  ./front
minikube image load ton-username/chat-front:latest
```

> Le front nécessite **Node.js 20** (Vite) : utiliser `node:20-alpine` dans le Dockerfile.

---

## 7.6 Initialiser la base Postgres

Après que le pod `postgres-0` soit en état `Running` :

```bash
kubectl exec -n chat-app -i postgres-0 -- psql -U user -d chat_db < scripts/init-db.sql
```

---

## 7.7 Health checks dans chaque service

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

## Points d'attention (Minikube + driver Docker)

| Problème | Solution |
|----------|----------|
| **ImagePullBackOff** | Utiliser `minikube image build` et `imagePullPolicy: Never` |
| **Timeout sur chat-app.local** | Lancer `minikube tunnel` et utiliser `127.0.0.1` dans /etc/hosts |
| **Ingress regex refusé** | Utiliser nginx comme API Gateway (tout le routage dans nginx.conf) |
| **Front build échoue (Vite)** | Passer à `node:20-alpine` dans le Dockerfile du front |

---

## Critères de validation
- [ ] Minikube démarre sans erreur
- [ ] Tous les pods sont en état `Running`
- [ ] Les health checks répondent (readiness/liveness probes)
- [ ] L'Ingress route correctement vers les services
- [ ] L'app est accessible sur `http://chat-app.local`
- [ ] Aucun secret n'est en dur dans les ConfigMaps
- [ ] Les données postgres persistent après redémarrage du pod