# Phase 10 — Monitoring

## Objectif
Mettre en place la stack Prometheus + Grafana + Loki pour visualiser les métriques et les logs, et Sentry pour tracker les erreurs applicatives.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre une métrique et un log ?
- Qu'est-ce que le "scraping" dans Prometheus ?
- Pourquoi centraliser les logs plutôt que les lire pod par pod avec `kubectl logs` ?
- Quelle est la différence entre Grafana et Prometheus ?

---

## Architecture monitoring

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

## 10.1 Prometheus + Grafana

### Installation via Helm
```bash
# Ajouter le repo Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Installer la stack complète (Prometheus + Grafana + AlertManager)
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace

# Accéder à Grafana
kubectl port-forward svc/monitoring-grafana -n monitoring 3030:80
# Login: admin / prom-operator
```

---

## 10.2 Exposer les métriques dans les services Node.js

### Installer prom-client
```bash
npm install prom-client
```

### Ajouter dans chaque service
```javascript
const promClient = require('prom-client')

// Métriques par défaut (CPU, mémoire, event loop...)
promClient.collectDefaultMetrics()

// Métriques custom — exemple service messaging
const messagesCounter = new promClient.Counter({
  name: 'chat_messages_total',
  help: 'Total number of messages sent',
  labelNames: ['room_id']
})

const activeConnectionsGauge = new promClient.Gauge({
  name: 'chat_active_connections',
  help: 'Number of active WebSocket connections'
})

// Route /metrics pour Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType)
  res.end(await promClient.register.metrics())
})

// Utilisation dans le code
io.on('connection', (socket) => {
  activeConnectionsGauge.inc()
  
  socket.on('send_message', ({ roomId, content }) => {
    messagesCounter.inc({ room_id: roomId })
    // ...
  })
  
  socket.on('disconnect', () => {
    activeConnectionsGauge.dec()
  })
})
```

### Métriques custom à créer par service

| Service | Métriques suggérées |
|---------|-------------------|
| **Auth** | `auth_logins_total`, `auth_failed_logins_total`, `auth_active_tokens` |
| **Messaging** | `chat_messages_total`, `chat_active_connections`, `chat_rooms_active` |
| **Profiles** | `profiles_updates_total`, `profiles_requests_total` |

---

## 10.3 Configurer Prometheus pour scraper les services

Créer un `ServiceMonitor` par service :
```yaml
# k8s/base/auth/service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: auth-monitor
  namespace: chat-app
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: auth
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

---

## 10.4 Dashboards Grafana

### Importer des dashboards existants
Dans Grafana → Dashboards → Import :
- **ID 1860** — Node Exporter Full (métriques système)
- **ID 15760** — Kubernetes pods overview

### Créer un dashboard custom Chat App
Créer un dashboard avec les panels suivants :
- Messages envoyés par minute (counter)
- Connexions WebSocket actives (gauge)
- Logins réussis vs échoués (bar chart)
- Latence des requêtes HTTP par service (histogram)
- Taux d'erreur HTTP 5xx (alert panel)

---

## 10.5 Loki + Promtail (logs centralisés)

```bash
# Ajouter le repo Grafana
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Installer Loki + Promtail
helm install loki grafana/loki-stack \
  -n monitoring \
  --set promtail.enabled=true \
  --set loki.enabled=true
```

### Configurer Loki comme datasource dans Grafana
1. Grafana → Configuration → Data Sources → Add
2. Type : Loki
3. URL : `http://loki:3100`

### Explorer les logs dans Grafana
```
# Voir les logs du service auth
{namespace="chat-app", app="auth"}

# Filtrer les erreurs
{namespace="chat-app"} |= "ERROR"

# Logs d'une requête spécifique
{app="messaging"} |= "socket.io"
```

---

## 10.6 Sentry (erreurs applicatives)

### Setup
1. Créer un compte sur [sentry.io](https://sentry.io) (gratuit)
2. Créer un projet par service + un projet front
3. Récupérer le DSN de chaque projet

### Installation dans les services Node.js
```bash
npm install @sentry/node
```

```javascript
const Sentry = require('@sentry/node')

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
})

// Middleware après les routes
app.use(Sentry.Handlers.errorHandler())
```

### Installation dans le front React
```bash
npm install @sentry/react
```

```javascript
import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE
})
```

---

## Critères de validation
- [ ] Prometheus scrape les métriques de tous les services
- [ ] Grafana accessible et affiche les métriques K8s
- [ ] Dashboard custom Chat App créé avec au moins 4 panels
- [ ] Loki collecte les logs de tous les pods
- [ ] Logs visibles dans Grafana avec des requêtes LogQL
- [ ] Sentry intégré dans les 3 services + front
- [ ] Une erreur volontaire dans le code apparaît dans Sentry
- [ ] Les métriques custom (messages, connexions) sont visibles dans Grafana