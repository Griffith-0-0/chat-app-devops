# Phase 11 — Alerting

## Objectif
Configurer AlertManager pour envoyer des notifications automatiques quand quelque chose ne va pas en production.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre une métrique et une alerte ?
- Qu'est-ce qu'AlertManager et quel est son rôle par rapport à Prometheus ?
- Pourquoi grouper et dédupliquer les alertes ?
- Qu'est-ce qu'une "dead man's switch" en monitoring ?

---

## Architecture

```
Prometheus évalue les règles d'alerte toutes les X secondes
              ↓
Si condition remplie → envoie l'alerte à AlertManager
              ↓
AlertManager déduplique, groupe, route
              ↓
Notification → Discord / Email
```

---

## 11.1 Règles d'alerte Prometheus

Créer `k8s/base/monitoring/alert-rules.yaml` :

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: chat-app-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: chat-app.availability
      interval: 30s
      rules:
        
        # Pod down depuis plus de 2 minutes
        - alert: PodDown
          expr: kube_pod_status_ready{namespace="chat-app"} == 0
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Pod {{ $labels.pod }} est down"
            description: "Le pod {{ $labels.pod }} est en état NotReady depuis plus de 2 minutes."

        # Redémarrages fréquents (crashloop)
        - alert: PodCrashLooping
          expr: rate(kube_pod_container_status_restarts_total{namespace="chat-app"}[15m]) > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Pod {{ $labels.pod }} crashloop"
            description: "Le pod {{ $labels.pod }} redémarre trop fréquemment."

    - name: chat-app.performance
      rules:
        
        # CPU élevé
        - alert: HighCPU
          expr: |
            rate(container_cpu_usage_seconds_total{namespace="chat-app"}[5m]) > 0.8
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "CPU élevé sur {{ $labels.pod }}"
            description: "Utilisation CPU > 80% depuis 5 minutes."

        # Mémoire élevée
        - alert: HighMemory
          expr: |
            container_memory_usage_bytes{namespace="chat-app"} / 
            container_spec_memory_limit_bytes{namespace="chat-app"} > 0.85
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Mémoire élevée sur {{ $labels.pod }}"

    - name: chat-app.errors
      rules:
        
        # Taux d'erreur HTTP 5xx > 5%
        - alert: HighErrorRate
          expr: |
            rate(http_requests_total{namespace="chat-app", status=~"5.."}[5m]) /
            rate(http_requests_total{namespace="chat-app"}[5m]) > 0.05
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Taux d'erreur élevé sur {{ $labels.service }}"
            description: "Plus de 5% des requêtes retournent une erreur 5xx."
```

> ⚠️ Pour que les alertes HTTP fonctionnent, tu dois exposer les métriques HTTP dans tes services Node.js (voir Phase 10).

---

## 11.2 Configurer AlertManager → Discord

### Créer un webhook Discord
1. Dans ton serveur Discord → Paramètres du channel → Intégrations → Webhooks
2. Créer un webhook et copier l'URL

### Configurer AlertManager

Dans Grafana ou directement via Helm values :

```yaml
# alertmanager-config.yaml
apiVersion: monitoring.coreos.com/v1alpha1
kind: AlertmanagerConfig
metadata:
  name: chat-app-alerting
  namespace: monitoring
spec:
  route:
    groupBy: ['alertname', 'namespace']
    groupWait: 30s
    groupInterval: 5m
    repeatInterval: 1h
    receiver: 'discord'
    routes:
      - matchers:
          - name: severity
            value: critical
        receiver: 'discord-critical'
  receivers:
    - name: 'discord'
      discordConfigs:
        - webhookURL: 'https://discord.com/api/webhooks/xxx/yyy'
          title: '⚠️ [{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
          message: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    
    - name: 'discord-critical'
      discordConfigs:
        - webhookURL: 'https://discord.com/api/webhooks/xxx/yyy'
          title: '🚨 CRITIQUE: {{ .GroupLabels.alertname }}'
          message: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## 11.3 Tester les alertes

### Simuler un pod down
```bash
# Scaler un deployment à 0 → déclenche l'alerte PodDown
kubectl scale deployment auth --replicas=0 -n chat-app

# Attendre 2 minutes → vérifier l'alerte dans AlertManager
kubectl port-forward svc/monitoring-alertmanager -n monitoring 9093:9093
# Accéder à http://localhost:9093

# Remettre à 1
kubectl scale deployment auth --replicas=1 -n chat-app
```

### Simuler une charge CPU élevée
```bash
# Entrer dans un pod et stresser le CPU
kubectl exec -it deployment/auth -n chat-app -- sh
# Dans le pod :
yes > /dev/null &
```

---

## Critères de validation
- [ ] Règles d'alerte Prometheus créées et actives
- [ ] AlertManager configuré avec Discord (ou email)
- [ ] Alerte PodDown testée et notification reçue sur Discord
- [ ] Alerte HighErrorRate configurée
- [ ] Les alertes se résolvent automatiquement quand le problème est corrigé
- [ ] AlertManager UI accessible (http://localhost:9093)