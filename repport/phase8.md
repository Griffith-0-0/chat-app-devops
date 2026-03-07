# Phase 8 — Helm Charts

## Définitions

**Outils :**
- **Helm** : Gestionnaire de paquets pour Kubernetes. Permet de templater des manifests K8s et de gérer des déploiements versionnés.
- **Chart** : Package Helm contenant `Chart.yaml`, `values.yaml` et des templates.
- **Release** : Instance déployée d’un chart (ex. release `auth` du chart `helm/auth`).
- **helm lint** : Vérifie la syntaxe et la cohérence d’un chart sans déployer.
- **helm upgrade --install** : Installe le chart s’il n’existe pas, sinon met à jour la release existante.

**Concepts :**
- **values.yaml** : Fichier de configuration par défaut du chart (image, ports, env, ressources). Surchargeable via `--set` ou des fichiers values.
- **Templates** : Fichiers YAML avec syntaxe Go (double accolades `{{ }}`) pour injecter les values.
- **b64enc** : Fonction Helm pour encoder une chaîne en base64 (utilisée pour les Secrets).
- **QoS Class** : Classe de qualité de service K8s — `BestEffort` (sans requests/limits), `Burstable` (avec requests et/ou limits), `Guaranteed` (requests = limits).
- **init container** : Conteneur optionnel qui s’exécute avant le conteneur principal (ex. attendre qu’une dépendance soit prête).

**Aspects de la phase :** Transformer les manifests K8s bruts en charts Helm paramétrables, faciliter les mises à jour de tags d’images, gérer les ressources CPU/mémoire, valider le rollback.

---

## 1. Contexte et objectifs

### 1.1 Objectif de la phase

- Créer un Helm chart pour chaque service applicatif (auth, profiles, messaging, front).
- Rendre les déploiements paramétrables (image, tag, env, ressources).
- Valider le flux : changement de tag → upgrade → rollback.
- Définir les ressources CPU/mémoire pour le scheduling et les limites.

### 1.2 Place dans le flux DevOps

```
Phase 7 (K8s manifests) → Phase 8 (Helm) → Phase 9 (Argo CD)
                                    ↓
                    helm/auth, helm/profiles, etc.
                                    ↓
                    values.yaml modifié par Jenkins (nouveau tag)
                                    ↓
                    Argo CD déploie automatiquement
```

---

## 2. Structure des charts Helm

```
helm/
├── auth/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── configmap.yaml
│       └── secret.yaml          # Seul auth a un Secret (JWT)
├── profiles/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── configmap.yaml
├── messaging/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── configmap.yaml
└── front/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── deployment.yaml
        └── service.yaml         # Pas de ConfigMap (config dans le build)
```

### 2.1 Différences entre les charts

| Service   | Secret | ConfigMap | Probes | Port |
|-----------|--------|-----------|--------|------|
| **auth**  | Oui (JWT_SECRET, JWT_REFRESH_SECRET) | Oui | readiness + liveness | 3001 |
| **profiles** | Non | Oui (PORT, DATABASE_URL, AUTH_SERVICE_URL) | Oui | 3002 |
| **messaging** | Non | Oui (+ REDIS_URL, RABBITMQ_URL) | Oui | 3003 |
| **front** | Non | Non (VITE_* au build) | Non | 80 |

---

## 3. Rôle de chaque fichier

### 3.1 Chart.yaml

Décrit le chart (nom, version, description).

```yaml
apiVersion: v2
name: chat-auth
description: Auth service for Chat App
type: application
version: 0.1.0
appVersion: "1.0.0"
```

### 3.2 values.yaml

Paramètres par défaut : image, service, env, secrets (auth uniquement), ressources.

Exemple (auth) :

```yaml
replicaCount: 1
image:
  repository: badrkhafif98/chat-auth
  tag: latest
  pullPolicy: Never
service:
  port: 3001
env:
  PORT: "3001"
  DATABASE_URL: "postgresql://user:password@postgres:5432/chat_db"
  REDIS_URL: "redis://redis:6379"
  JWT_EXPIRES_IN: "15m"
  JWT_REFRESH_EXPIRES_IN: "7d"
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
```

### 3.3 secret.yaml (auth uniquement)

Encode les valeurs sensibles en base64 pour le Secret K8s :

```yaml
data:
  JWT_SECRET: {{ .Values.secrets.JWT_SECRET | b64enc | quote }}
  JWT_REFRESH_SECRET: {{ .Values.secrets.JWT_REFRESH_SECRET | b64enc | quote }}
```

### 3.4 deployment.yaml

Utilise `{{ .Values.* }}` pour l’image, le port, envFrom (ConfigMap + Secret si auth), probes, et ressources :

```yaml
resources:
  {{- toYaml .Values.resources | nindent 12 }}
```

---

## 4. Étapes et commandes utilisées

### 4.1 Vérifier la syntaxe des charts

```bash
helm lint helm/auth helm/profiles helm/messaging helm/front
```

Sortie attendue : `3 chart(s) linted, 0 chart(s) failed`.

---

### 4.2 Démarrer Minikube (prérequis)

```bash
minikube start
kubectl cluster-info
```

Si le cluster n’est pas démarré, `helm install` échoue avec : `cluster reachability check failed: kubernetes cluster unreachable`.

---

### 4.3 Nettoyer un déploiement manuel existant

Si des ressources ont été créées avec `kubectl apply -f k8s/base/`, Helm ne peut pas les gérer (conflit de métadonnées). Solution : supprimer le namespace et redéployer avec Helm.

```bash
kubectl delete namespace chat-app
```

---

### 4.4 Installer les charts

```bash
helm install auth helm/auth -n chat-app --create-namespace \
  --set secrets.JWT_SECRET=xxx \
  --set secrets.JWT_REFRESH_SECRET=xxx

helm install profiles helm/profiles -n chat-app
helm install messaging helm/messaging -n chat-app
helm install front helm/front -n chat-app
```

---

### 4.5 Déployer Postgres, Redis, RabbitMQ

Les charts Helm ne gèrent que les services applicatifs. L’infrastructure reste en manifests K8s :

```bash
kubectl apply -f k8s/base/postgres/ -n chat-app
kubectl apply -f k8s/base/redis/ -n chat-app
kubectl apply -f k8s/base/rabbitmq/ -n chat-app
```

Ordre recommandé : infrastructure avant messaging (messaging dépend de RabbitMQ).

---

### 4.6 Tester le changement de tag

```bash
helm upgrade auth helm/auth -n chat-app --set image.tag=v2

kubectl get pods -n chat-app -l app=auth -o jsonpath='{.items[0].spec.containers[0].image}'
# Résultat attendu : badrkhafif98/chat-auth:v2
```

---

### 4.7 Tester le rollback

```bash
helm history auth -n chat-app
helm rollback auth 1 -n chat-app

kubectl get pods -n chat-app -l app=auth -o jsonpath='{.items[0].spec.containers[0].image}'
# Résultat attendu : badrkhafif98/chat-auth:latest
```

---

### 4.8 Appliquer les ressources CPU/mémoire

Les ressources définies dans `values.yaml` ne sont appliquées qu’après un upgrade :

```bash
helm upgrade auth helm/auth -n chat-app
helm upgrade profiles helm/profiles -n chat-app
helm upgrade messaging helm/messaging -n chat-app
helm upgrade front helm/front -n chat-app
```

Vérifier dans le dashboard Minikube : le pod doit passer en **QoS Class: Burstable** (au lieu de BestEffort).

---

### 4.9 Visualiser dans le dashboard Minikube

```bash
minikube dashboard
```

Dans Workloads → Pods → sélectionner un pod : on voit les graphs CPU/Memory Usage et la QoS Class.

---

## 5. Difficultés rencontrées et solutions

### 5.1 Cluster Kubernetes unreachable

**Problème :** `Error: INSTALLATION FAILED: cluster reachability check failed: kubernetes cluster unreachable: dial tcp 127.0.0.1:55912: connection refused`

**Cause :** Minikube n’est pas démarré ou le cluster a été arrêté. Le port de l’API change à chaque démarrage.

**Solution :**
```bash
minikube start
kubectl cluster-info
```
Puis réessayer `helm install`.

---

### 5.2 Ressources existantes non gérées par Helm

**Problème :** `Service "front" in namespace "chat-app" exists and cannot be imported into the current release: invalid ownership metadata; label validation error: missing key "app.kubernetes.io/managed-by"`

**Cause :** Les ressources ont été créées avec `kubectl apply -f k8s/base/` et n’ont pas les labels/annotations Helm (`app.kubernetes.io/managed-by: Helm`, etc.).

**Solution :** Supprimer le namespace et tout redéployer avec Helm :
```bash
kubectl delete namespace chat-app
helm install auth helm/auth -n chat-app --create-namespace --set secrets.JWT_SECRET=xxx --set secrets.JWT_REFRESH_SECRET=xxx
helm install profiles helm/profiles -n chat-app
helm install messaging helm/messaging -n chat-app
helm install front helm/front -n chat-app
```

---

### 5.3 Messaging en CrashLoopBackOff

**Problème :** Le pod messaging redémarre en boucle. Logs : `Error: Could not connect to RabbitMQ after retries`.

**Cause :** Messaging a été déployé avant Postgres, Redis et RabbitMQ. Le service tente de se connecter à des ressources inexistantes.

**Solution 1 (court terme) :** Déployer l’infrastructure, puis forcer un redémarrage du pod :
```bash
kubectl apply -f k8s/base/postgres/ -n chat-app
kubectl apply -f k8s/base/redis/ -n chat-app
kubectl apply -f k8s/base/rabbitmq/ -n chat-app

kubectl delete pod -n chat-app -l app=messaging
```
Le ReplicaSet recrée un pod qui démarre avec RabbitMQ disponible.

**Solution 2 (bonne pratique) :** Déployer dans l’ordre : infrastructure → auth → profiles → messaging → front.

---

### 5.4 Ressources non appliquées (QoS BestEffort)

**Problème :** `kubectl get pod ... -o jsonpath='{.items[0].spec.containers[0].resources}'` retourne `{}`. Le dashboard affiche QoS Class: BestEffort.

**Cause :** Le pod a été déployé avant l’ajout de la section `resources` dans `values.yaml` et le template `deployment.yaml`. Helm ne met pas à jour automatiquement les pods déjà en place sans upgrade.

**Solution :**
```bash
helm upgrade auth helm/auth -n chat-app
helm upgrade profiles helm/profiles -n chat-app
helm upgrade messaging helm/messaging -n chat-app
helm upgrade front helm/front -n chat-app
```
Vérifier ensuite : QoS Class doit passer à **Burstable**.

---

## 6. Synthèse des modifications

| Fichier / zone | Modification |
|----------------|--------------|
| `helm/auth/` | Chart complet (Chart.yaml, values, deployment, service, configmap, secret) |
| `helm/profiles/` | Chart (sans secret) |
| `helm/messaging/` | Chart (sans secret) |
| `helm/front/` | Chart (sans configmap, sans probes) |
| `values.yaml` (tous) | Section `resources` (requests + limits) |
| `templates/deployment.yaml` (tous) | Bloc `resources: {{- toYaml .Values.resources \| nindent 12 }}` |

---

## 7. Points importants

1. **auth seul avec Secret** : JWT_SECRET et JWT_REFRESH_SECRET doivent être fournis via `--set` ou un fichier values. Ne pas les laisser vides en production.
2. **Ordre de déploiement** : Infrastructure (postgres, redis, rabbitmq) avant messaging. Auth et profiles peuvent démarrer en parallèle.
3. **imagePullPolicy: Never** : En dev avec Minikube, les images sont locales (`minikube image build` / `minikube image load`).
4. **Ressources** : 128Mi/256Mi et 100m/200m CPU pour tous les services. Garantissent une QoS Burstable et évitent la surconsommation.
5. **Rollback** : `helm rollback <release> <revision>` permet de revenir à une version antérieure en cas de problème.
6. **front sans ConfigMap** : La config (URLs VITE_*) est injectée au build Docker, pas au runtime.

---

## 8. Critères de validation (Phase 8)

| Critère | Statut |
|---------|--------|
| Helm chart créé pour les 4 services | ✅ |
| `helm lint` passe sans erreur | ✅ |
| Déploiement via `helm upgrade --install` fonctionne | ✅ |
| Changer le tag + redéployer → nouvelle image utilisée | ✅ |
| `helm rollback` fonctionne | ✅ |
| Ressources CPU/mémoire définies et appliquées (QoS Burstable) | ✅ |
