# Phase 7 — Kubernetes (Minikube)

## Définitions

**Outils :**
- **Minikube** : Outil pour exécuter un cluster Kubernetes local (un nœud) dans une VM ou conteneur.
- **kubectl** : CLI officielle pour interagir avec un cluster Kubernetes (créer, lister, décrire des ressources).
- **Nginx Ingress Controller** : Addon Minikube qui gère le routage HTTP/HTTPS entrant vers les Services K8s.
- **minikube tunnel** : Commande qui expose les Services de type LoadBalancer et l’Ingress sur l’hôte (127.0.0.1) en créant une route réseau.
- **Helm** : Gestionnaire de paquets pour Kubernetes (non utilisé dans cette phase ; prévu Phase 8).

**Concepts :**
- **Pod** : Plus petite unité déployable dans K8s ; un ou plusieurs conteneurs partageant réseau et stockage.
- **Deployment** : Contrôleur qui gère des Pods (création, réplication, rolling update).
- **Service** : Point d’accès réseau stable (nom DNS + port) vers un ensemble de Pods.
- **StatefulSet** : Contrôleur pour applications avec état (identité stable, volumes persistants par pod).
- **ConfigMap** : Stockage de configuration non sensible (variables d’environnement, fichiers).
- **Secret** : Stockage de données sensibles (mots de passe, clés) encodées en base64.
- **Namespace** : Regroupement logique de ressources (isolation, quotas).
- **Ingress** : Règle de routage HTTP pour exposer des Services vers l’extérieur du cluster.
- **PersistentVolumeClaim (PVC)** : Demande de stockage persistant pour les Pods.
- **imagePullPolicy: Never** : Utilise uniquement l’image locale, sans tenter de la télécharger depuis un registre.

**Aspects de la phase :** Déployer l’application Chat App sur Kubernetes en local, configurer le routage via Ingress, et exposer l’app sur `http://chat-app.local`.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

- Démarrer un cluster Kubernetes local avec Minikube.
- Déployer tous les services (auth, profiles, messaging, front) et l’infra (Postgres, Redis, RabbitMQ).
- Configurer le routage HTTP via Nginx Ingress et un reverse proxy interne (nginx).
- Rendre l’application accessible sur `http://chat-app.local`.

### 1.2 Place dans le flux DevOps

```
GitHub → Jenkins (CI) → Docker Hub (images)
                              ↓
                    Argo CD (Phase 9) → Kubernetes
                              ↑
                    Phase 7 : préparation des manifests K8s
```

---

## 2. Structure des manifests K8s

```
k8s/base/
├── namespace.yaml           # Namespace chat-app
├── ingress.yaml             # Ingress → nginx (point d'entrée unique)
├── nginx/                   # API Gateway (reverse proxy interne)
│   ├── configmap.yaml       # Configuration nginx.conf
│   ├── deployment.yaml
│   └── service.yaml
├── auth/
│   ├── configmap.yaml       # Variables d'environnement (PORT, DATABASE_URL, etc.)
│   ├── secret.yaml          # JWT_SECRET, JWT_REFRESH_SECRET
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
│   ├── statefulset.yaml     # Base de données avec volume persistant
│   └── service.yaml
├── redis/
│   ├── deployment.yaml
│   └── service.yaml
└── rabbitmq/
    ├── deployment.yaml
    └── service.yaml
```

---

## 3. Rôle de chaque fichier et outil

### 3.1 Namespace (`k8s/base/namespace.yaml`)

| Élément | Rôle |
|---------|------|
| `kind: Namespace` | Regroupe toutes les ressources de l’app dans un espace isolé. |
| `name: chat-app` | Permet de filtrer avec `kubectl -n chat-app` et d’éviter les conflits avec d’autres projets. |

---

### 3.2 Ingress (`k8s/base/ingress.yaml`)

| Élément | Rôle |
|---------|------|
| `kind: Ingress` | Point d’entrée HTTP unique pour le cluster. |
| `host: chat-app.local` | Trafic adressé à ce hostname est routé vers le backend. |
| `path: /` | Tout le trafic (/, /api/auth, /socket.io, etc.) est envoyé au service nginx. |
| `backend: nginx:80` | Un seul backend : le service nginx, qui fait le routage interne. |
| `proxy-read-timeout`, `proxy-send-timeout` | Augmentent les timeouts pour les WebSockets (Socket.io). |

**Pourquoi un seul backend ?** Les snippets et les chemins regex sont désactivés dans l’Ingress Minikube. On centralise donc tout le routage dans un service nginx dédié.

---

### 3.3 Nginx — API Gateway (`k8s/base/nginx/`)

| Fichier | Rôle |
|---------|------|
| **configmap.yaml** | Contient la configuration `nginx.conf` : upstreams (auth, profiles, messaging, front) et règles de routage. |
| **deployment.yaml** | Lance le conteneur `nginx:alpine` avec le ConfigMap monté. |
| **service.yaml** | Expose nginx sur le port 80 à l’intérieur du cluster. |

**Routage dans nginx.conf :**

| Chemin | Backend | Exemple |
|--------|---------|---------|
| `/api/auth/health` | auth:3001/health | Health check auth |
| `/api/auth/*` | auth:3001/auth/* | Register, login, logout, etc. |
| `/api/profiles/*` | profiles:3002/profiles/* | CRUD profil |
| `/api/messages/*` | messaging:3003/messages/* | Messages REST |
| `/socket.io/*` | messaging:3003/socket.io/* | WebSocket (chat temps réel) |
| `/` | front:80/ | SPA React |

---

### 3.4 Services applicatifs (auth, profiles, messaging, front)

| Ressource | Rôle |
|-----------|------|
| **ConfigMap** | Variables d’environnement non sensibles (PORT, DATABASE_URL, REDIS_URL, AUTH_SERVICE_URL, etc.). |
| **Secret** (auth uniquement) | JWT_SECRET, JWT_REFRESH_SECRET (encodés en base64). |
| **Deployment** | Définit l’image, les env, les probes (readiness, liveness). |
| **Service** | Donne un nom DNS et un port stable aux autres services (ex. `auth:3001`). |

**Probes :**

| Probe | Rôle |
|-------|------|
| **readinessProbe** | Pod marqué prêt uniquement si `/health` répond 200. |
| **livenessProbe** | Redémarre le pod si `/health` ne répond plus. |

**imagePullPolicy: Never** : En dev local avec Minikube, les images sont chargées via `minikube image build` ou `minikube image load`. Cette politique évite d’aller les chercher sur un registre.

---

### 3.5 Infrastructure (Postgres, Redis, RabbitMQ)

| Composant | Type | Rôle |
|-----------|------|------|
| **Postgres** | StatefulSet + Service | Base de données avec identité stable et volume persistant (volumeClaimTemplates). |
| **Redis** | Deployment + Service | Cache et sessions. |
| **RabbitMQ** | Deployment + Service | Message broker (messaging). Ports 5672 (AMQP) et 15672 (UI). |

**StatefulSet vs Deployment :** Postgres a besoin d’un stockage persistant et d’un nom stable (postgres-0). Le StatefulSet crée un PVC par pod et conserve l’identité après redémarrage.

---

## 4. Commandes pour lancer et tester

### 4.1 Démarrer Minikube

```bash
# Démarrer le cluster
minikube start --driver=docker --cpus=4 --memory=6g

# Activer les addons
minikube addons enable ingress
minikube addons enable metrics-server

# Vérifier
kubectl get nodes
kubectl get pods -A
```

### 4.2 Construire les images (en dev local)

Les images doivent être construites dans le contexte Minikube ou chargées dans Minikube :

```bash
# Méthode recommandée : build direct dans Minikube
minikube image build -t badrkhafif98/chat-auth:latest ./services/auth
minikube image build -t badrkhafif98/chat-profiles:latest ./services/profiles
minikube image build -t badrkhafif98/chat-messaging:latest ./services/messaging

# Front : build avec les bonnes URLs puis chargement
docker build -t badrkhafif98/chat-front:latest \
  --build-arg VITE_AUTH_URL=http://chat-app.local/api \
  --build-arg VITE_PROFILES_URL=http://chat-app.local/api \
  --build-arg VITE_SOCKET_URL=http://chat-app.local \
  --build-arg VITE_API_URL=http://chat-app.local/api \
  ./front
minikube image load badrkhafif98/chat-front:latest
```

### 4.3 Appliquer les manifests

```bash
# Depuis la racine du projet
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/postgres/
kubectl apply -f k8s/base/redis/
kubectl apply -f k8s/base/rabbitmq/
kubectl apply -f k8s/base/auth/
kubectl apply -f k8s/base/profiles/
kubectl apply -f k8s/base/messaging/
kubectl apply -f k8s/base/front/
kubectl apply -f k8s/base/nginx/
kubectl apply -f k8s/base/ingress.yaml

# Ou en une commande
kubectl apply -f k8s/base/ -R
```

### 4.4 Initialiser la base Postgres

```bash
# Attendre que postgres-0 soit Running
kubectl get pods -n chat-app

# Exécuter le script d'init
kubectl exec -n chat-app -i postgres-0 -- psql -U user -d chat_db < scripts/init-db.sql
```

### 4.5 Configurer l’accès local

```bash
# 1. Lancer le tunnel (à garder actif dans un terminal)
minikube tunnel
# Entrer le mot de passe sudo si demandé

# 2. Configurer /etc/hosts (avec 127.0.0.1 pour le tunnel)
sudo sed -i '' '/chat-app.local/d' /etc/hosts
echo "127.0.0.1 chat-app.local" | sudo tee -a /etc/hosts
```

### 4.6 Tests

```bash
# Vérifier les pods
kubectl get pods -n chat-app

# Tester l'API health
curl http://chat-app.local/api/auth/health

# Tester l'inscription
curl -X POST http://chat-app.local/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!"}'
```

**Navigateur :** Ouvrir `http://chat-app.local` pour tester l’inscription, la connexion, le profil et le chat.

---

## 5. Difficultés rencontrées et solutions

### 5.1 ImagePullBackOff / ErrImageNeverPull

**Problème :** Le kubelet ne trouve pas l’image locale ou tente de la télécharger depuis un registre.

**Cause :** `docker build` ou `minikube image load` ne place pas toujours l’image au bon endroit pour le runtime de Minikube.

**Solution :**
- Utiliser `minikube image build -t <image> <context>` pour construire directement dans Minikube.
- Ajouter `imagePullPolicy: Never` dans les Deployments pour forcer l’usage de l’image locale.

---

### 5.2 Timeout sur chat-app.local (port 80)

**Problème :** `curl http://chat-app.local` ou le navigateur ne répondent pas (timeout).

**Cause :** Avec le driver Docker, l’IP de Minikube (192.168.49.x) n’est pas routable depuis l’hôte. L’Ingress doit être exposé via `minikube tunnel`.

**Solution :**
- Lancer `minikube tunnel` dans un terminal dédié et le laisser actif.
- Mettre `127.0.0.1 chat-app.local` dans `/etc/hosts` (et non l’IP de Minikube).

---

### 5.3 Ingress : regex et configuration-snippet désactivés

**Problème :** Les chemins avec regex (`/api/auth(/|$)(.*)`) et l’annotation `configuration-snippet` sont refusés par l’admission webhook de Minikube.

**Solution :** Utiliser un service nginx interne comme API Gateway. L’Ingress route tout vers nginx (path `/`), et nginx gère le routage détaillé via sa config (ConfigMap).

---

### 5.4 Front : Node.js 18 incompatible avec Vite

**Problème :** Le build du front échoue avec « Vite requires Node.js version 20.19+ ».

**Solution :** Modifier le Dockerfile du front pour utiliser `node:20-alpine` à la place de `node:18-alpine`.

---

### 5.5 Erreur d’inscription (400 Bad Request)

**Problème :** Message générique « Erreur lors de l'inscription » côté front.

**Cause :** Le mot de passe doit avoir au moins 6 caractères ; le serveur renvoie une erreur de validation.

**Solution :** Afficher le message d’erreur réel de l’API dans le front : `setError(err.response?.data?.error || "Erreur lors de l'inscription")`.

---

## 6. Synthèse des modifications

| Fichier / zone | Modification |
|----------------|--------------|
| `k8s/base/namespace.yaml` | Création du namespace chat-app |
| `k8s/base/ingress.yaml` | Ingress unique pointant vers le service nginx |
| `k8s/base/nginx/` | ConfigMap, Deployment, Service pour l’API Gateway |
| `k8s/base/auth/`, `profiles/`, `messaging/`, `front/` | ConfigMaps, Secrets, Deployments, Services |
| `k8s/base/postgres/` | StatefulSet + Service avec volumeClaimTemplates |
| `k8s/base/redis/`, `rabbitmq/` | Deployments + Services |
| `front/Dockerfile` | Passage à `node:20-alpine` |
| `front/src/pages/Register.jsx` | Affichage du message d’erreur API |

---

## 7. Points importants

1. **minikube tunnel** : Indispensable avec le driver Docker pour accéder à l’Ingress depuis l’hôte. `/etc/hosts` doit pointer vers `127.0.0.1`.
2. **Nginx comme Gateway** : Contourne les limitations de l’Ingress (pas de regex ni de snippets). Reprend l’architecture du `docker-compose`.
3. **Images locales** : `minikube image build` et `imagePullPolicy: Never` pour éviter les problèmes de pull en dev.
4. **Ordre de déploiement** : Postgres et Redis avant auth ; auth avant profiles et messaging.
5. **Health checks** : readinessProbe et livenessProbe sur `/health` pour une gestion correcte des déploiements et des redémarrages.
6. **Secrets** : Ne pas mettre de secrets en clair dans les ConfigMaps ; utiliser des Secrets K8s et les encoder en base64.
