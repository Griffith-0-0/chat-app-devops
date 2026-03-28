# Phase 16 — SLO / Observabilité avancée (SLI, SLO, Runbooks)

## Objectif
Définir des SLI (indicateurs de niveau de service) et des SLO (objectifs de niveau de service) pour la Chat App, créer des alertes basées sur ces objectifs, et rédiger des runbooks pour les incidents courants.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre SLI, SLO et SLA ?
- Qu'est-ce qu'un error budget ?
- Pourquoi les alertes basées sur des SLO sont plus utiles que des alertes sur des seuils fixes ?
- Qu'est-ce qu'un runbook ? À quoi sert-il en production ?
- Qu'est-ce que le multi-window, multi-burn-rate alerting ?

---

## Définitions

| Terme | Définition |
|-------|-----------|
| **SLI** | Indicateur mesuré : taux d'erreur, latence, disponibilité |
| **SLO** | Objectif sur un SLI : ex. 99.9% de disponibilité sur 30 jours |
| **Error Budget** | Marge d'erreur autorisée avant violation du SLO |
| **SLA** | Engagement contractuel avec des pénalités (hors scope ici) |
| **Runbook** | Documentation de procédure pour répondre à un incident |

---

## 16.1 Définir les SLI par service

### Service Auth

| SLI | Formule PromQL | Objectif |
|-----|---------------|---------|
| Disponibilité | `rate(http_requests_total{status!~"5.."}[5m]) / rate(http_requests_total[5m])` | 99.9% |
| Latence p99 | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))` | < 500ms |
| Taux d'erreur login | `rate(auth_logins_total{status="failure"}[5m])` | < 5% |

### Service Messaging

| SLI | Formule PromQL | Objectif |
|-----|---------------|---------|
| Disponibilité WebSocket | `rate(chat_active_connections[5m]) >= 0` | 99.5% |
| Latence messages | `histogram_quantile(0.95, rate(chat_message_duration_seconds_bucket[5m]))` | < 200ms |
| Taux de livraison | `rate(chat_messages_total[5m])` | > 0 (pas de perte) |

### Service Profiles

| SLI | Formule PromQL | Objectif |
|-----|---------------|---------|
| Disponibilité | `up{job="profiles"}` | 99.9% |
| Latence GET profil | `histogram_quantile(0.95, rate(profiles_http_request_duration_seconds_bucket{method="GET"}[5m]))` | < 300ms |

---

## 16.2 Configurer les SLO dans Prometheus

### Règle de calcul du SLO Auth (disponibilité)

```yaml
# k8s/base/monitoring/slo-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: chat-app-slo
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: slo-auth-availability
      interval: 1m
      rules:
        # Taux de succès sur 5 minutes
        - record: job:http_success_rate:5m
          expr: |
            sum(rate(http_requests_total{job="auth", status!~"5.."}[5m]))
            /
            sum(rate(http_requests_total{job="auth"}[5m]))

        # Taux de succès sur 1 heure (pour multi-window)
        - record: job:http_success_rate:1h
          expr: |
            sum(rate(http_requests_total{job="auth", status!~"5.."}[1h]))
            /
            sum(rate(http_requests_total{job="auth"}[1h]))

        # Taux de succès sur 30 jours (SLO window)
        - record: job:http_success_rate:30d
          expr: |
            sum(rate(http_requests_total{job="auth", status!~"5.."}[30d]))
            /
            sum(rate(http_requests_total{job="auth"}[30d]))
```

---

## 16.3 Alertes basées sur les SLO (multi-burn-rate)

```yaml
# Alerte SLO — burn rate élevé (consommation rapide de l'error budget)
    - name: slo-alerts
      rules:
        # Alerte critique : burn rate x14 sur 1h (error budget épuisé en 2 jours)
        - alert: AuthSLOBurnRateCritical
          expr: |
            job:http_success_rate:1h{job="auth"} < (1 - 14 * 0.001)
          for: 2m
          labels:
            severity: critical
            slo: auth-availability
          annotations:
            summary: "SLO Auth en danger critique"
            description: "Taux de succès < 98.6% depuis 2 min (burn rate x14, error budget épuisé en 2 jours)"

        # Alerte warning : burn rate x6 sur 6h (error budget épuisé en 5 jours)
        - alert: AuthSLOBurnRateWarning
          expr: |
            job:http_success_rate:6h{job="auth"} < (1 - 6 * 0.001)
          for: 15m
          labels:
            severity: warning
            slo: auth-availability
          annotations:
            summary: "SLO Auth en danger"
            description: "Taux de succès < 99.4% depuis 15 min (burn rate x6)"

        # Alerte latence p99
        - alert: AuthHighLatency
          expr: |
            histogram_quantile(0.99,
              rate(http_request_duration_seconds_bucket{job="auth"}[5m])
            ) > 0.5
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Latence Auth p99 > 500ms"
```

---

## 16.4 Dashboard SLO dans Grafana

### Panels recommandés

| Panel | Formule | Type |
|-------|---------|------|
| Taux de succès (30j) | `job:http_success_rate:30d` | Stat (%) |
| Error budget restant | `(job:http_success_rate:30d - 0.999) / 0.001 * 100` | Gauge (%) |
| Burn rate actuel | `(1 - job:http_success_rate:1h) / 0.001` | Stat |
| Latence p50 / p95 / p99 | `histogram_quantile(0.99, ...)` | Time series |
| Erreurs par minute | `rate(http_requests_total{status=~"5.."}[5m])` | Time series |

### Importer un dashboard SLO

Utiliser le dashboard Grafana ID **14348** (SLO / Error Budget Dashboard) comme base.

---

## 16.5 Runbooks

Les runbooks sont des documents de procédure pour répondre à chaque type d'incident. Créer un fichier par alerte dans `docs/runbooks/`.

### Template de runbook

```markdown
# Runbook : <NomAlerte>

## Contexte
Décrit ce que fait l'alerte et pourquoi elle se déclenche.

## Impact
Décrit ce que l'utilisateur ressent.

## Diagnostic
Étapes pour identifier la cause :
1. Vérifier les pods : `kubectl get pods -n chat-app`
2. Consulter les logs : `kubectl logs -f deployment/<service> -n chat-app`
3. Vérifier les métriques dans Grafana

## Résolution
Actions correctives :
1. Redémarrer le pod : `kubectl rollout restart deployment/<service> -n chat-app`
2. Scaler le service : `kubectl scale deployment/<service> --replicas=3 -n chat-app`
3. Rollback Helm : `helm rollback <release> -n chat-app`

## Escalade
Si le problème persiste après 15 min, escalader à l'équipe infra.
```

### Runbooks à créer

| Fichier | Alerte associée |
|---------|----------------|
| `docs/runbooks/pod-down.md` | PodDown |
| `docs/runbooks/high-error-rate.md` | AuthSLOBurnRateCritical |
| `docs/runbooks/high-latency.md` | AuthHighLatency |
| `docs/runbooks/high-memory.md` | HighMemoryUsage |
| `docs/runbooks/messaging-down.md` | Messaging service indisponible |

---

## 16.6 Error Budget — suivi mensuel

```yaml
# Calcul de l'error budget restant (disponibilité 99.9% = 43.8 min/mois)
# Si taux de succès sur 30j = 99.7% → error budget consommé à 30%
# Error budget restant = (taux_actuel - SLO) / (1 - SLO) * 100
```

Afficher dans Grafana :
- Pourcentage d'error budget consommé
- Projection : à ce rythme, quand sera-t-il épuisé ?

---

## Critères de validation
- [ ] SLI définis pour auth, profiles, messaging (disponibilité + latence)
- [ ] Règles PromQL enregistrées (recording rules) dans PrometheusRule
- [ ] Alertes SLO configurées (multi-burn-rate)
- [ ] Dashboard Grafana SLO avec error budget visible
- [ ] Runbooks rédigés pour les 5 alertes principales
- [ ] Une alerte SLO déclenchée et reçue sur Discord
- [ ] Error budget affiché et calculé en temps réel
