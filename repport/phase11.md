# Phase 11 — Alerting (Prometheus + AlertManager + Discord)

## Définitions rapides

- **Métrique**: valeur numérique collectée dans le temps (CPU, mémoire, requêtes, erreurs).
- **Alerte**: règle Prometheus qui passe en `pending` puis `firing` si une condition reste vraie pendant `for`.
- **Alertmanager**: composant qui reçoit les alertes, les groupe, les route, puis envoie des notifications (Discord, email, etc.).
- **Webhook**: URL secrète permettant à un service externe (Discord) de recevoir des messages POST.

---

## 1) Objectif de la phase

Mettre en place des règles d'alerte pour détecter automatiquement une indisponibilité du service `auth`, configurer le routing vers Discord, et valider le cycle complet:

```
UP → DOWN → FIRING (Prometheus) → AlertManager → Discord → UP → RESOLVED
```

---

## 2) Architecture

```
Prometheus évalue les règles toutes les 30s
              ↓
Si condition remplie (for: 30s) → envoie l'alerte à AlertManager
              ↓
AlertManager déduplique, groupe, route (severity=critical → discord-critical)
              ↓
Notification → Discord #alerts
```

---

## 3) État de départ et redémarrage environnement

Le cluster et la stack monitoring ont été relancés et vérifiés.

### Commandes exécutées

```bash
minikube start
minikube addons enable ingress
kubectl get nodes

kubectl get ns

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace

helm upgrade --install loki grafana/loki-stack \
  -n monitoring \
  -f loki-stack-values.yaml

kubectl get pods -n monitoring
kubectl get pods -n chat-app
```

---

## 4) Règles d'alerte Prometheus

### 4.1 Fichier `k8s/base/monitoring/alert-rules.yaml`

| Alerte | Rôle | Severity | Expression |
|--------|------|----------|------------|
| `PodDown` | Pod NotReady | warning | `kube_pod_status_ready{...} == 0` |
| `AuthServiceMissing` | Service auth indisponible | critical | `absent(up{namespace="chat-app", job="auth"})` |

**Pourquoi `absent(up{...})` au lieu de `kube_pod_status_ready` ?**  
Avec `replicas=0`, le pod n'existe plus — la métrique `kube_pod_status_ready` disparaît donc aucune série n'est évaluée. `absent(up{...})` détecte l'absence de target Prometheus, ce qui correspond bien à "service indisponible".

### 4.2 Commandes

```bash
mkdir -p k8s/base/monitoring
kubectl apply -f k8s/base/monitoring/alert-rules.yaml
kubectl get prometheusrule -n monitoring
```

---

## 5) AlertmanagerConfig (routing vers Discord)

### 5.1 Secret K8s pour le webhook (bonne pratique sécurité)

L'URL webhook Discord ne doit **jamais** être en clair dans Git. Elle est stockée dans un Secret:

```bash
kubectl create secret generic alertmanager-discord-webhook \
  -n monitoring \
  --from-literal=webhook-url='https://discord.com/api/webhooks/XXX/YYY'
```

**Créer le webhook Discord:**  
Serveur Discord → Salon `#alerts` → Modifier le salon → Intégrations → Webhooks → Nouveau webhook → Copier l'URL.

### 5.2 Fichier `k8s/base/monitoring/alertmanager-config.yaml`

- `severity=critical` → receiver `discord-critical` (Discord)
- Autres → receiver `default-null` (silencieux)

Structure importante: `receivers` doit être au niveau `spec`, **pas** imbriqué dans `route`.

```bash
kubectl apply -f k8s/base/monitoring/alertmanager-config.yaml
kubectl describe alertmanagerconfig chat-app-alertmanager -n monitoring | grep -A8 "Receivers"
```

---

## 6) Problèmes rencontrés et solutions

| Problème | Cause | Solution |
|----------|-------|----------|
| **PodDown ne fire pas avec `replicas=0`** | La règle `kube_pod_status_ready == false` ne voit plus de série quand le pod est supprimé | Créer une alerte `AuthServiceMissing` avec `absent(up{namespace="chat-app", job="auth"})` |
| **`unknown field "webhookURL"`** | Le CRD `AlertmanagerConfig` utilise `apiURL`, pas `webhookURL` | Remplacer `webhookURL` par `apiURL` dans `discordConfigs` |
| **Erreur YAML `mapping values are not allowed`** | `title` et `message` mal indentés (sous `key` au lieu de sous `discordConfigs`) | Aligner `title` et `message` au même niveau que `apiURL` |
| **`unknown field "spec.route.receivers"`** | `receivers` placé sous `route` au lieu de `spec` | Déplacer `receivers` au niveau racine de `spec` |
| **Alertes visibles dans Alertmanager UI mais pas sur Discord** | Par défaut, `AlertmanagerConfig` en namespace `monitoring` ajoute un matcher implicite `namespace="monitoring"`. Les alertes `chat-app` ont `namespace="chat-app"` → pas de match | Créer `monitoring-values.yaml` avec `alertmanagerConfigMatcherStrategy: type: None` et faire `helm upgrade ... -f monitoring-values.yaml` |

### 6.1 Fichier `monitoring-values.yaml` (à la racine)

```yaml
alertmanager:
  alertmanagerSpec:
    alertmanagerConfigMatcherStrategy:
      type: None
```

```bash
helm upgrade monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --reuse-values \
  -f monitoring-values.yaml

kubectl rollout status statefulset/alertmanager-monitoring-kube-prometheus-alertmanager -n monitoring
```

---

## 7) Tests réalisés

### 7.1 Port-forward

```bash
# Prometheus
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090

# Alertmanager
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093
```

- Prometheus UI: `http://localhost:9090`
- Alertmanager UI: `http://localhost:9093`

### 7.2 Test cycle complet

1. S'assurer que `auth` est UP: `kubectl scale deployment auth --replicas=1 -n chat-app`
2. Mettre DOWN: `kubectl scale deployment auth --replicas=0 -n chat-app`
3. Attendre ~45-60s
4. Vérifier Prometheus Alerts: `AuthServiceMissing` en **FIRING**
5. Vérifier Discord: notification reçue dans `#alerts`
6. Remettre UP: `kubectl scale deployment auth --replicas=1 -n chat-app`
7. Les alertes passent en **RESOLVED**

### 7.3 Requêtes PromQL utiles

```promql
ALERTS{alertname="AuthServiceMissing"}
ALERTS{alertname="AuthServiceMissing", alertstate="firing"}
absent(up{namespace="chat-app", job="auth"})
```

*(Ces requêtes s'exécutent dans l'onglet Query de Prometheus, pas dans le terminal.)*

---

## 8) Fichiers créés/modifiés

| Fichier | Rôle |
|---------|------|
| `k8s/base/monitoring/alert-rules.yaml` | Règles Prometheus (PodDown, AuthServiceMissing) |
| `k8s/base/monitoring/alertmanager-config.yaml` | Routing Alertmanager (critical → Discord) |
| `monitoring-values.yaml` | Helm values: `alertmanagerConfigMatcherStrategy: None` |
| Secret `alertmanager-discord-webhook` (namespace monitoring) | URL webhook Discord (créé via `kubectl create secret`) |

---

## 9) Captures d'écran à ajouter

- [ ] Prometheus `Alerts` avec `AuthServiceMissing` en `FIRING`
- [ ] Alertmanager UI (`Status`) avec config contenant `discord-critical`
- [ ] Discord `#alerts` avec les notifications reçues (AuthServiceMissing + autres alertes K8s)
- [ ] Prometheus `Target health` montrant `auth-monitor` 0/0 quand `replicas=0`

---

## 10) Bonnes pratiques appliquées

- **Webhook dans Secret K8s**: pas d'URL en clair dans Git (évite spam, fuite de secrets).
- **Salon Discord dédié `#alerts`**: séparation des alertes des autres messages d'équipe.
- **Deux receivers** (`default-null` et `discord-critical`): permet d'ajuster plus tard (ex. routing warning vers email).
- **`alertmanagerConfigMatcherStrategy: None`**: approche entreprise pour configs multi-namespace (chaque équipe gère ses alertes).
- **`for: 30s`**: évite les faux positifs sur micro-coupures.

### Autres canaux de notification possibles

Alertmanager supporte plusieurs receivers (Discord, email, Slack, PagerDuty, etc.). Pour ce projet, Discord suffit. En production, on peut ajouter :
- **Email (Gmail, SMTP)** : pour escalade critique ou on-call
- **Slack** : équivalent Discord selon l'outil de l'équipe
- **PagerDuty / OpsGenie** : gestion d'incidents et on-call

---

## 11) Commandes utiles (récap)

```bash
# Règles et config
kubectl get prometheusrule -n monitoring
kubectl get alertmanagerconfig -n monitoring

# Simuler incident / restaurer
kubectl scale deployment auth --replicas=0 -n chat-app
kubectl scale deployment auth --replicas=1 -n chat-app

# Port-forward
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093

# Logs Alertmanager
kubectl logs alertmanager-monitoring-kube-prometheus-alertmanager-0 -n monitoring -c alertmanager --tail=30
```

---

## 12) Critères de validation Phase 11

| Critère | Statut |
|---------|--------|
| Règles Prometheus (PodDown, AuthServiceMissing) créées et actives | ✅ |
| AlertmanagerConfig avec receiver Discord (apiURL via Secret) | ✅ |
| `alertmanagerConfigMatcherStrategy: None` pour routing multi-namespace | ✅ |
| Notification reçue sur Discord quand `auth` est down | ✅ |
| Alertes se résolvent automatiquement quand le problème est corrigé | ✅ |
| Alertmanager UI accessible (http://localhost:9093) | ✅ |
