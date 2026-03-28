# Phase 15 — Observabilité avancée (Traces + Métriques custom + Alerting)

## Objectif
Approfondir l'observabilité avec les traces distribuées (Jaeger/Tempo), des métriques custom par service, et des règles d'alerte Prometheus + AlertManager avec notifications Discord.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre une métrique, un log et une trace ?
- Qu'est-ce qu'une trace distribuée ? Pourquoi est-elle utile dans une architecture microservices ?
- Comment fonctionne le sampling dans Jaeger ?
- Qu'est-ce qu'une règle d'alerte Prometheus (PrometheusRule) ?
- Comment AlertManager route les alertes vers Discord ?

---

## Architecture observabilité étendue

```
Requête HTTP
    │
    ├── Span 1 : nginx
    ├── Span 2 : auth
    ├── Span 3 : profiles
    └── Span 4 : messaging
         │
         └── Jaeger / Tempo collecte la trace complète

Services Node.js → /metrics → Prometheus → Grafana
                                   │
                                   └── PrometheusRules → AlertManager → Discord
```

---

## 15.1 Traces distribuées avec Jaeger

### Installer Jaeger sur Kubernetes

```bash
# Ajouter le repo Helm Jaeger
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo update

# Installer Jaeger All-in-one (dev)
helm install jaeger jaegertracing/jaeger \
  -n monitoring \
  --set allInOne.enabled=true \
  --set provisionDataStore.cassandra=false \
  --set storage.type=memory

# Accéder à l'UI Jaeger
kubectl port-forward svc/jaeger-query -n monitoring 16686:16686
```

UI Jaeger accessible sur **http://localhost:16686**

### Intégrer OpenTelemetry dans les services Node.js

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-jaeger
```

```javascript
// tracing.js — à require avant tout autre module
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger-collector:14268/api/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

```javascript
// Dans index.js — avant les autres imports
require('./tracing');
```

### Ajouter JAEGER_ENDPOINT dans les ConfigMaps

```yaml
# k8s/base/auth/configmap.yaml
data:
  JAEGER_ENDPOINT: "http://jaeger-collector.monitoring:14268/api/traces"
```

---

## 15.2 Métriques custom par service

### Auth — métriques spécifiques

```javascript
const promClient = require('prom-client');
promClient.collectDefaultMetrics();

const loginCounter = new promClient.Counter({
  name: 'auth_logins_total',
  help: 'Nombre total de connexions',
  labelNames: ['status'] // 'success' ou 'failure'
});

const activeTokensGauge = new promClient.Gauge({
  name: 'auth_active_tokens',
  help: 'Nombre de tokens actifs (non blacklistés)'
});

// Utilisation dans /login
loginCounter.inc({ status: 'success' });
loginCounter.inc({ status: 'failure' });

// Route /metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### Messaging — métriques spécifiques

```javascript
const messagesCounter = new promClient.Counter({
  name: 'chat_messages_total',
  help: 'Nombre total de messages envoyés',
  labelNames: ['room_id']
});

const activeConnectionsGauge = new promClient.Gauge({
  name: 'chat_active_connections',
  help: 'Connexions WebSocket actives'
});

const messageLatency = new promClient.Histogram({
  name: 'chat_message_duration_seconds',
  help: 'Durée de traitement d\'un message',
  buckets: [0.01, 0.05, 0.1, 0.5, 1]
});
```

### Profiles — métriques spécifiques

```javascript
const profileUpdatesCounter = new promClient.Counter({
  name: 'profiles_updates_total',
  help: 'Nombre de mises à jour de profil'
});

const httpRequestDuration = new promClient.Histogram({
  name: 'profiles_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
});
```

---

## 15.3 ServiceMonitors Prometheus

Créer un ServiceMonitor par service pour que Prometheus les scrape :

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

```bash
kubectl apply -f k8s/base/auth/service-monitor.yaml
kubectl apply -f k8s/base/profiles/service-monitor.yaml
kubectl apply -f k8s/base/messaging/service-monitor.yaml
```

---

## 15.4 Règles d'alerte Prometheus (PrometheusRule)

```yaml
# k8s/base/monitoring/alert-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: chat-app-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: chat-app
      rules:
        - alert: HighFailedLogins
          expr: rate(auth_logins_total{status="failure"}[5m]) > 0.5
          for: 2m
          labels:
            severity: warning
          annotations:
            summary: "Taux d'échecs de connexion élevé"
            description: "Plus de 0.5 échecs/s depuis 2 min"

        - alert: PodDown
          expr: up{namespace="chat-app"} == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Pod {{ $labels.job }} est down"
            description: "Le pod ne répond plus depuis 1 min"

        - alert: HighMemoryUsage
          expr: container_memory_usage_bytes{namespace="chat-app"} > 200 * 1024 * 1024
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Utilisation mémoire élevée dans {{ $labels.container }}"
```

---

## 15.5 AlertManager → Discord

### Configurer le webhook Discord

1. Sur Discord : Paramètres du serveur → Intégrations → Webhooks → Nouveau webhook
2. Copier l'URL du webhook

### Configurer AlertManager

```yaml
# k8s/base/monitoring/alertmanager-config.yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-monitoring-kube-prometheus-alertmanager
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
    route:
      receiver: discord
      group_by: ['alertname', 'namespace']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
    receivers:
      - name: discord
        discord_configs:
          - webhook_url: 'https://discord.com/api/webhooks/TON_WEBHOOK'
            title: '{{ .GroupLabels.alertname }}'
            message: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

### Tester une alerte

```bash
# Simuler un pod down
kubectl scale deployment auth -n chat-app --replicas=0

# Vérifier dans AlertManager
kubectl port-forward svc/monitoring-kube-prometheus-alertmanager -n monitoring 9093:9093
```

UI AlertManager : **http://localhost:9093**

---

## 15.6 Dashboards Grafana avancés

### Dashboard Chat App custom

Créer un dashboard avec ces panels :
- Messages envoyés par minute (rate sur `chat_messages_total`)
- Connexions WebSocket actives (`chat_active_connections`)
- Logins réussis vs échoués (`auth_logins_total` avec labels)
- Latence des requêtes par service (histogram `_duration_seconds`)
- Taux d'erreur 5xx
- Uptime des pods

### Importer des dashboards existants

| Dashboard ID | Description |
|-------------|-------------|
| 1860 | Node Exporter Full (métriques système) |
| 15760 | Kubernetes pods overview |
| 13332 | Kubernetes API Server |

---

## Critères de validation
- [ ] Jaeger installé et accessible sur http://localhost:16686
- [ ] Traces visibles dans Jaeger pour auth, profiles, messaging
- [ ] Métriques custom exposées sur `/metrics` de chaque service
- [ ] ServiceMonitors créés et Prometheus scrape les services
- [ ] Règles d'alerte PrometheusRule créées et actives
- [ ] AlertManager configuré pour envoyer sur Discord
- [ ] Une alerte déclenchée et reçue sur Discord
- [ ] Dashboard Grafana custom avec au moins 6 panels
