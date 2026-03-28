# Phase 10 — Monitoring (Prometheus + Grafana + Loki)

## Définitions

**Outils :**
- **Prometheus** : Base de données de séries temporelles qui collecte (scrape) les métriques exposées par les applications via HTTP.
- **Grafana** : Outil de visualisation qui affiche les métriques (graphiques, dashboards) à partir de Prometheus, Loki et autres datasources.
- **prom-client** : Bibliothèque Node.js pour exposer des métriques au format Prometheus (Counters, Gauges, Histograms).
- **ServiceMonitor** : Ressource CRD (Custom Resource Definition) du Prometheus Operator qui indique à Prometheus quels services scraper.
- **Loki** : Système de stockage de logs, inspiré de Prometheus (requêtes LogQL), conçu pour les logs.
- **Promtail** : Agent qui collecte les logs stdout/stderr des pods K8s et les envoie à Loki.
- **Sentry** : Service SaaS pour capturer les erreurs applicatives (exceptions JS/Node, stack traces).

**Concepts :**
- **Métrique** : Valeur numérique agrégée dans le temps (ex. "42 logins réussis"). Sert aux graphiques, alertes, tendances.
- **Log** : Ligne de texte produite à un instant donné (ex. "ERROR: Invalid token"). Sert au debug, traçage.
- **Scraping** : Prometheus interroge périodiquement (ex. toutes les 15s) l'endpoint `/metrics` des services et récupère le texte au format exposition Prometheus.
- **Format exposition** : Texte simple avec `# HELP`, `# TYPE` et des lignes `nom_metrique valeur` que Prometheus parse.

**Aspects de la phase :** Mettre en place la stack de monitoring complète — métriques applicatives, logs centralisés, capture des erreurs.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

- Installer et configurer Prometheus + Grafana (via kube-prometheus-stack).
- Exposer des métriques custom dans les services Node.js (auth, profiles, messaging).
- Configurer Prometheus pour scraper ces services via ServiceMonitor.
- Créer des dashboards Grafana pour visualiser les métriques de la Chat App.
- Installer Loki + Promtail pour centraliser les logs.
- Intégrer Sentry pour tracker les erreurs applicatives.

### 1.2 Place dans le flux DevOps

```
Services déployés sur K8s (Argo CD)
        ↓
Exposent /metrics (prom-client)
        ↓
Prometheus scrape via ServiceMonitor
        ↓
Grafana affiche les dashboards

services/auth/src/index.js
    console.log("User connected")
    console.error("JWT invalid")
            │
            │ Kubernetes capture stdout/stderr
            ▼
    /var/log/pods/chat-app_auth-xxx/auth/0.log
            │
            │ Promtail surveille ce fichier
            ▼
    Promtail ajoute labels {app="auth", namespace="chat-app"}
            │
            │ HTTP POST vers Loki
            ▼
    Loki stocke les logs indexés par labels
            │
            │ Requête LogQL depuis Grafana
            ▼
    Grafana affiche les logs dans l'interface
```

---

## 2. Architecture monitoring

```
Services Node.js  →  expose /metrics  →  Prometheus scrape
                                              ↓
                                          Grafana affiche

Pods K8s          →  stdout/stderr    →  Promtail collecte  →  Loki stocke
                                                                    ↓
                                                              Grafana affiche

Services/Front    →  erreurs JS/Node  →  Sentry capture
```

---

## 3. État actuel et étapes réalisées

### 3.1 10.1 — Prometheus + Grafana ✅

**Installation :** kube-prometheus-stack déjà installé dans le namespace `monitoring`.

Composants vérifiés :

| Composant | Service | Rôle |
|-----------|---------|------|
| Grafana | `monitoring-grafana` | Visualisation |
| Prometheus | `monitoring-kube-prometheus-prometheus` | Collecte des métriques |
| AlertManager | `monitoring-kube-prometheus-alertmanager` | Alertes |
| Node Exporter | `monitoring-prometheus-node-exporter` | Métriques système des nœuds |
| kube-state-metrics | `monitoring-kube-state-metrics` | Métriques des ressources K8s |

**Accès Grafana :**
```bash
kubectl port-forward svc/monitoring-grafana -n monitoring 3030:80
# Login: admin / prom-operator (ou mot de passe défini lors de l'install)
```

---

### 3.2 10.2 — Métriques dans le service Auth ✅ (partiel)

**Fichiers modifiés/créés :**

| Fichier | Action |
|---------|--------|
| `services/auth/package.json` | `npm install prom-client` |
| `services/auth/src/metrics.js` | Nouveau — définit les métriques |
| `services/auth/src/app.js` | Route `GET /metrics` |
| `services/auth/src/routes/auth.js` | Incrémentation des compteurs (register, login, failed login) |

**Métriques exposées :**
- `auth_logins_total` — logins réussis
- `auth_failed_logins_total` — logins échoués (user inexistant ou mauvais mot de passe)
- `auth_registers_total` — inscriptions réussies
- Métriques système par défaut (CPU, mémoire, event loop) avec préfixe `auth_`

---

## 4. Explication de l'intégration des métriques

### 4.1 Flux global

```
[Requête login] → [routes/auth.js] → metrics.loginsTotal.inc()
                                            ↓
[Prometheus] → GET /metrics toutes les 15s → [app.js] → metrics.getMetrics()
                                            ↓
                              Texte formaté (Prometheus exposition format)
```

Prometheus appelle périodiquement `/metrics` et stocke les valeurs en séries temporelles.

### 4.2 Rôle de chaque fichier

| Fichier | Rôle |
|---------|------|
| **metrics.js** | Déclare les Counters (`loginsTotal`, `failedLoginsTotal`, `registersTotal`), active `collectDefaultMetrics`, exporte `getMetrics()` et `getContentType()`. |
| **app.js** | Expose la route `GET /metrics` qui renvoie le texte des métriques (Content-Type Prometheus). |
| **routes/auth.js** | Incrémente les compteurs aux bons endroits : `registersTotal.inc()` après inscription OK, `failedLoginsTotal.inc()` si credentials invalides, `loginsTotal.inc()` après login OK. |

### 4.3 Types de métriques

| Type | Usage | Exemple |
|------|-------|---------|
| **Counter** | Compteur qui ne fait qu'augmenter | `auth_logins_total` |
| **Gauge** | Valeur qui monte/descend | Connexions actives (messaging) |
| **Histogram** | Distribution de valeurs (latence, taille) | Latence des requêtes HTTP |

### 4.4 Format d'exposition Prometheus

La route `/metrics` renvoie du texte brut :

```
# HELP auth_logins_total Total number of successful logins
# TYPE auth_logins_total counter
auth_logins_total 42
# HELP auth_failed_logins_total Total number of failed login attempts
# TYPE auth_failed_logins_total counter
auth_failed_logins_total 3
```

Prometheus parse ce format et stocke les séries temporelles.

### 4.5 Pourquoi un module séparé `metrics.js` ?

- Centralisation : toutes les métriques au même endroit.
- Réutilisation : les routes font `metrics.xxx.inc()` sans connaître le détail.
- Testabilité : on peut tester le module indépendamment.

### 4.6 Vérification locale

```bash
# Tester le module metrics
cd services/auth && node -e "
const metrics = require('./src/metrics');
(async () => {
  const m = await metrics.getMetrics();
  console.log(m.split('\n').filter(l => l.includes('auth_')).join('\n'));
})();
"
```

---

## 5. Étapes de lancement (redémarrage complet)

Après un arrêt de Minikube ou pour relancer tout l'environnement :

```bash
# 1. Démarrer Minikube
minikube start --driver=docker --cpus=4 --memory=6g

# 2. Activer les addons
minikube addons enable ingress
minikube addons enable metrics-server

# 3. Déployer l'infra (namespace, postgres, redis, rabbitmq, nginx)
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/postgres/
kubectl apply -f k8s/base/redis/
kubectl apply -f k8s/base/rabbitmq/
kubectl apply -f k8s/base/nginx/

# 4. Initialiser la base de données (tables users, profiles, messages)
kubectl exec -i postgres-0 -n chat-app -- psql -U user -d chat_db < scripts/init-db.sql

# 5. Builder et charger les images dans Minikube
eval $(minikube docker-env)
docker build -t badrkhafif98/chat-auth:latest ./services/auth
docker build -t badrkhafif98/chat-profiles:latest ./services/profiles
docker build -t badrkhafif98/chat-messaging:latest ./services/messaging
docker build -t badrkhafif98/chat-front:latest \
  --build-arg VITE_AUTH_URL=/api \
  --build-arg VITE_PROFILES_URL=/api \
  --build-arg VITE_API_URL=/api \
  --build-arg VITE_SOCKET_URL= \
  --build-arg VITE_SENTRY_DSN="https://9b239ef2e8259747beff0faa2e0c606e@o4511023079882752.ingest.de.sentry.io/4511023381807184" \
  ./front

# 6. Déployer les services via Helm (ou laisser Argo CD sync)
helm upgrade --install auth ./helm/auth -n chat-app
helm upgrade --install profiles ./helm/profiles -n chat-app
helm upgrade --install messaging ./helm/messaging -n chat-app
helm upgrade --install front ./helm/front -n chat-app

# 7. Appliquer l'Ingress
kubectl apply -f k8s/base/ingress.yaml

# 8. Configurer Prometheus pour scraper chat-app (si pas déjà fait)
helm upgrade monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --reuse-values \
  --set prometheus.prometheusSpec.serviceMonitorNamespaceSelector={}

# 9. Loki + Promtail (logs centralisés, si pas déjà installé)
helm upgrade --install loki grafana/loki-stack -n monitoring -f loki-stack-values.yaml

# 10. Host local (à exécuter une fois)
echo "127.0.0.1 chat-app.local" | sudo tee -a /etc/hosts

# 11. Tunnel (terminal séparé)
minikube tunnel
```

**Port-forwards** (à lancer dans des terminaux séparés selon besoins) :

```bash
# Accès Chat App (via Ingress) — port 8888
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8888:80

# Grafana
kubectl port-forward svc/monitoring-grafana -n monitoring 3030:80

# Prometheus
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090

# Argo CD
kubectl port-forward svc/argocd-server -n argocd 8090:443
```

**URLs d'accès :**

| Service | URL |
|---------|-----|
| Chat App | http://chat-app.local:8888 |
| Grafana | http://localhost:3030 |
| Prometheus | http://localhost:9090 |
| Argo CD | https://localhost:8090 |

---

## 6. Prochaines étapes (à faire)

| Étape | Description | Statut |
|-------|-------------|--------|
| 10.2 | Métriques profiles et messaging | ✅ |
| 10.3 | ServiceMonitors (auth, profiles, messaging) | ✅ |
| 10.4 | Dashboard Grafana Chat App | ✅ |
| 10.5 | Installer **Loki + Promtail** pour les logs centralisés | ✅ |
| 10.6 | Intégrer **Sentry** dans les 3 services + front | ✅ |

---

## 7. Critères de validation (Phase 10)

| Critère | Statut |
|---------|--------|
| Prometheus + Grafana installés (kube-prometheus-stack) | ✅ |
| Route /metrics exposée (auth, profiles, messaging) | ✅ |
| Métriques custom (logins, messages, connexions) | ✅ |
| Prometheus scrape les métriques de tous les services | ✅ |
| Dashboard custom Chat App créé (5 panels) | ✅ |
| Loki collecte les logs de tous les pods | ✅ |
| Logs visibles dans Grafana (LogQL) | ✅ |
| Sentry intégré (3 services + front) | ✅ |
| Erreur volontaire visible dans Sentry | ✅ (auth + front) |

---

## 9. 10.5 — Loki + Promtail (logs centralisés)

### Installation

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Avec fichier values (recommandé) — évite conflit isDefault avec Prometheus + Loki 2.9.3 compatible Grafana 12
helm install loki grafana/loki-stack -n monitoring -f loki-stack-values.yaml

# Ou upgrade si déjà installé
helm upgrade loki grafana/loki-stack -n monitoring -f loki-stack-values.yaml
```

**Fichier `loki-stack-values.yaml`** (à la racine du projet) :
- `loki.isDefault: false` — Prometheus reste la datasource par défaut (kube-prometheus-stack)
- `loki.image.tag: "2.9.3"` — compatible avec le health check de Grafana 12

**Note :** Le chart loki-stack est déprécié mais fonctionne pour un environnement de dev. Pour la prod, privilégier les charts séparés (grafana/loki + grafana/promtail).

### Vérification de l'installation

```bash
kubectl get pods -n monitoring | grep -E 'loki|promtail'
kubectl get svc -n monitoring | grep loki
```

### Configurer Loki dans Grafana

La datasource Loki est **provisionnée automatiquement** par le chart (ConfigMap monté via sidecar Grafana). URL : `http://loki:3100`.

Si "Save & Test" échouait auparavant :
- **Conflit isDefault** : deux datasources marquées "default" → résolu par `loki.isDefault: false`
- **Parse error** : Loki 2.6.x incompatible avec le health check Grafana 12 → résolu par Loki 2.9.3

Supprimer les datasources Loki créées manuellement avec des URLs incorrectes (`localhost:3100`, `loki-gateway`).

### Requêtes LogQL (Explorer → Loki)

```
{namespace="chat-app", app="auth"}
{namespace="chat-app"} |= "ERROR"
{app="messaging"} |= "socket"
```

---

## 10. 10.6 — Sentry (erreurs applicatives)

### Service Auth (réalisé)

**Fichiers modifiés/créés :**

| Fichier | Action |
|---------|--------|
| `services/auth/src/instrument.js` | Nouveau — init Sentry (DSN, environment) |
| `services/auth/src/index.js` | `require("./instrument.js")` en premier |
| `services/auth/src/app.js` | Import Sentry + `Sentry.setupExpressErrorHandler(app)` après les routes |
| `helm/auth/values.yaml` | `secrets.SENTRY_DSN` |
| `helm/auth/templates/secret.yaml` | Variable `SENTRY_DSN` |

**Route de test :** `GET /debug-sentry` dans `services/auth/src/app.js` (ligne 31) — à retirer avant production.

**Configuration Helm :** Le DSN Sentry est stocké dans un **Secret** (`auth-secrets`), pas dans le ConfigMap.

> **Remarque (production) :** Ne pas mettre le DSN en dur dans `values.yaml`. Passer la valeur via `--set` pour éviter de commiter des secrets :
> ```bash
> helm upgrade auth ./helm/auth -n chat-app --set secrets.SENTRY_DSN="https://xxx@o4511023079882752.ingest.de.sentry.io/4511023094693968"
> ```
> Ou utiliser un gestionnaire de secrets (Sealed Secrets, External Secrets, Vault).

### Services Profiles et Messaging (réalisé)

Même pattern que auth : `instrument.js`, `app.js` + `Sentry.setupExpressErrorHandler`, `SENTRY_DSN` dans le ConfigMap (même DSN Node.js que auth).

### Front React (réalisé — selon [Sentry React SDK skill](https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-react-sdk/SKILL.md))

- `@sentry/react` + `@sentry/vite-plugin`
- `src/instrument.js` — init Sentry (tracing, session replay, DSN)
- `main.jsx` — `import "./instrument"` en premier ; `reactErrorHandler()` sur `createRoot` (React 19)
- `vite.config.js` — `sourcemap: 'hidden'`, `sentryVitePlugin` pour l’upload des source maps
- Dockerfile : `VITE_SENTRY_DSN`, `VITE_APP_VERSION`

**Source maps :** pour les stack traces lisibles, définir en build :  
`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (voir `.env.sentry-build-plugin` ou variables d’environnement).

**Bouton de test :** `ErrorButton` dans `front/src/pages/Login.jsx` — à retirer avant production.

### Commandes pour rebuild et tester

```bash
# 1. Envoyer le contexte Docker vers Minikube
eval $(minikube docker-env)

# 2. Rebuild les images
docker build -t badrkhafif98/chat-auth:latest ./services/auth
docker build -t badrkhafif98/chat-profiles:latest ./services/profiles
docker build -t badrkhafif98/chat-messaging:latest ./services/messaging
docker build -t badrkhafif98/chat-front:latest \
  --build-arg VITE_AUTH_URL=/api \
  --build-arg VITE_PROFILES_URL=/api \
  --build-arg VITE_API_URL=/api \
  --build-arg VITE_SOCKET_URL= \
  --build-arg VITE_SENTRY_DSN="https://9b239ef2e8259747beff0faa2e0c606e@o4511023079882752.ingest.de.sentry.io/4511023381807184" \
  ./front

# 3. Redéployer
helm upgrade --install auth ./helm/auth -n chat-app
helm upgrade --install profiles ./helm/profiles -n chat-app
helm upgrade --install messaging ./helm/messaging -n chat-app
helm upgrade --install front ./helm/front -n chat-app

# 4. Redémarrer les déploiements pour charger les nouvelles images
kubectl rollout restart deployment/auth deployment/profiles deployment/messaging deployment/front -n chat-app

# 5. Attendre la mise à jour
kubectl rollout status deployment/front -n chat-app
```

Puis : `minikube tunnel` (si besoin), ouvrir http://chat-app.local:8888/login et cliquer sur « Test Sentry » pour déclencher l’erreur.

**Note :** Si Sentry ne reçoit pas l'erreur front (requête `net::ERR_BLOCKED_BY_CLIENT`), désactiver le bloqueur de publicités ou tester en navigation privée.

---

## 11. Commandes utiles

```bash
# Vérifier la stack monitoring
kubectl get svc -n monitoring

# Accéder à Grafana
kubectl port-forward svc/monitoring-grafana -n monitoring 3030:80

# Accéder à Prometheus (pour tester les requêtes PromQL)
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
```
