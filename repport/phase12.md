# Phase 12 — Sécurité (état au 27 mars 2026)

## Définitions rapides

- **ConfigMap vs Secret** : un ConfigMap sert à de la configuration non sensible (URLs, flags). Un `Secret` est le type K8s prévu pour les données sensibles (tokens, mots de passe) ; il est encodé en base64 dans l’API (pas du chiffrement fort) et doit être protégé par RBAC et, en production, par un chiffrement au repos du cluster.
- **Network Policy** : règles L3/L4 appliquées par le CNI (ex. Calico) qui autorisent ou refusent le trafic **ingress** (vers le pod) et **egress** (depuis le pod). Sans CNI compatible, les objets existent mais ne sont pas appliqués.
- **SecurityContext** : contraintes sur l’identité et les capacités du process dans le conteneur (`runAsNonRoot`, `readOnlyRootFilesystem`, `capabilities`, etc.).
- **ImagePullPolicy** : `Never` = n’utiliser que l’image présente sur le nœud ; `IfNotPresent` / `Always` = tirer depuis une registry si besoin.

---

## 1) Objectif de la phase (rappel `docs/Phase12.md`)

Renforcer la posture sécurité du déploiement Chat App sur Kubernetes :

- audit des secrets et bonnes pratiques de stockage ;
- isolation réseau entre pods (principe du moindre privilège) ;
- durcissement des conteneurs applicatifs (`securityContext`) ;
- (à finaliser selon le sujet) scan Trivy planifié et RBAC Jenkins.

---

## 2) Prérequis cluster : CNI et Network Policies

Les Network Policies ne sont effectives que si le CNI les applique. Vérification effectuée sur Minikube :

```bash
minikube ssh "ls /etc/cni/net.d/"
```

Présence de `10-calico.conflist` et `calico-kubeconfig` → **Calico actif**, les policies sont appliquées.

Démarrage Minikube avec CNI adapté (rappel doc) :

```bash
minikube start --driver=docker --cni=calico
minikube addons enable ingress
```

---

## 3) Section 12.1 — Audit des secrets

### 3.1 Vérifications réalisées

| Point | Résultat |
|-------|----------|
| Secrets dans un objet `Secret` K8s (ex. `auth-secrets`) | Oui |
| Valeurs encodées en base64 dans le manifeste | Oui |
| Contenu JWT initialement de type *placeholder* (`change_this_secret_in_production`) | Identifié ; rotation possible via `kubectl create secret ... --dry-run=client \| kubectl apply -f -` |
| Historique Git des fichiers `.env` | `git log --all --full-history -- "**/.env" "*.env"` — pas de fuite attendue dans l’historique |

### 3.2 Rappel pédagogique

Un JWT « fort » se génère par ex. :

```bash
openssl rand -base64 32
```

---

## 4) Images Docker, registry et état de Nginx

### 4.1 Symptômes

- **`ErrImageNeverPull`** : `imagePullPolicy: Never` alors que l’image n’existait pas sur le nœud Minikube.
- **`ImagePullBackOff`** avec message `pull access denied ... may require 'docker login'` : images sur Docker Hub en **accès restreint** sans `imagePullSecret`, ou tag **`latest` absent** (Jenkins pousse souvent `:<build_number>` et pas `:latest`).

### 4.2 Mesures mises en place

1. **`imagePullSecrets`** : secret `docker-registry` `dockerhub-credentials` dans `chat-app` (à renouveler si le token Docker Hub est exposé — **révoquer le token sur hub.docker.com** s’il a été partagé dans un chat ou un dépôt).
2. **Build local dans le daemon Minikube** pour le développement :

   ```bash
   eval $(minikube docker-env)
   docker build -t badrkhafif98/chat-auth:latest ./services/auth
   # idem profiles, messaging, front
   ```

3. **`imagePullPolicy: Never`** rétabli pour ces quatre services afin d’utiliser les images construites dans Minikube (cohérent avec un TP local sans `:latest` sur le Hub).

### 4.3 Nginx (API Gateway)

- Erreur initiale : **`host not found in upstream "auth:3001"`** au démarrage de Nginx quand le service `auth` / les pods n’existaient pas encore ou quand le DNS / l’egress était bloqué (voir section 5.3).
- Une fois les services applicatifs présents et le réseau corrigé, le pod **nginx** repasse en **Running**.

---

## 5) Section 12.2 — Network Policies

### 5.1 Fichiers sous `k8s/base/network-policies/`

| Fichier | Rôle |
|---------|------|
| `default-deny.yaml` | Refuse tout **ingress** et tout **egress** pour tous les pods du namespace `chat-app` (sélecteur vide `podSelector: {}`). |
| `allow-ingress-to-services.yaml` | Autorise le trafic **ingress** depuis le namespace `ingress-nginx` vers les pods `app=auth`, `app=profiles`, `app=messaging`. |
| `allow-services-to-db.yaml` | Autorise **ingress** vers `postgres` (5432), `redis` (6379), `rabbitmq` (5672) depuis les pods applicatifs listés. |
| `allow-egress-dns.yaml` | Autorise **egress** UDP/TCP **53** vers `kube-system` (résolution DNS / CoreDNS). **Nécessaire** après un default-deny qui bloque aussi l’egress. |
| `allow-egress-within-namespace.yaml` | Autorise **egress** de tout pod du namespace vers tout autre pod du même namespace (communication Nginx → auth, services → DB, etc.). |

### 5.2 Commandes utiles

```bash
kubectl apply -f k8s/base/network-policies/
kubectl get networkpolicy -n chat-app
```

### 5.3 Problème rencontré : Nginx / DNS après default-deny

Le `default-deny` incluait **Ingress + Egress**. Sans règle d’egress vers CoreDNS, les pods ne résolvent plus les noms de service (`auth`, `postgres`, …).  
**Correction** : ajout de `allow-egress-dns.yaml` et `allow-egress-within-namespace.yaml`.

### 5.4 Test pédagogique (front → PostgreSQL)

Depuis le pod **front** :

```bash
kubectl exec -it -n chat-app deployment/front -- sh
nc -zv postgres 5432
# ou wget vers postgres
```

Observation : **`bad address 'postgres'`** — le front ne peut pas résoudre ni joindre la base (egress/DNS filtrés + absence de règle autorisant le front vers postgres en ingress sur postgres : **comportement conforme** à l’objectif « le front ne parle pas à la DB directement »).

### 5.5 Flux réseau légitime (rappel)

- Utilisateur → **Ingress** → **nginx** → **auth / profiles / messaging** (HTTP/WebSocket).
- **auth / profiles / messaging** → **postgres / redis / rabbitmq** selon les besoins métier.
- Le **front** (static) ne doit **pas** ouvrir de session TCP vers PostgreSQL.

---

## 6) Section 12.3 — SecurityContext

### 6.1 Services Node.js (`auth`, `profiles`, `messaging`)

Fichiers : [`k8s/base/auth/deployment.yaml`](../k8s/base/auth/deployment.yaml), profiles, messaging.

| Élément | Détail |
|---------|--------|
| Pod `securityContext` | `runAsNonRoot: true`, `runAsUser: 1000`, `fsGroup: 1000` (aligné avec `USER appuser` / groupe Alpine) |
| Conteneur | `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]` |
| Volume | `emptyDir` monté sur `/tmp` (écritures temporaires sans rendre la racine modifiable) |

### 6.2 Nginx (`nginx` gateway, `front`)

Images **nginx:alpine** (entrypoint officiel avec `chown` sur les répertoires cache).

Tentative initiale avec `readOnlyFileSystem` + `capabilities.drop: ["ALL"]` → échecs (`chown ... Operation not permitted`).  
**Décision** : conserver **`allowPrivilegeEscalation: false`** uniquement pour ces deux déploiements (compromis documenté).

---

## 7) Synthèse des problèmes et solutions

| Problème | Cause | Solution |
|----------|--------|----------|
| Nginx `host not found in upstream auth` | Services/pods `auth` absents ou DNS/egress bloqués | Déployer auth + policies egress DNS / intra-namespace |
| `ErrImageNeverPull` | `imagePullPolicy: Never` sans image locale | Build dans `minikube docker-env` ou tirer depuis le Hub |
| `pull access denied` sur Hub | Repo privé ou tag `:latest` inexistant | `imagePullSecret` + tags cohérents avec Jenkins, ou build local `:latest` |
| Front / Nginx restart loop après `securityContext` | `drop ALL` incompatible avec `chown` entrypoint | Retirer `drop ALL` sur les déploiements Nginx ; garder le durcissement sur Node |
| Apps « silencieuses » après default-deny | Egress DNS / interne non autorisé | `allow-egress-dns` + `allow-egress-within-namespace` |

---

## 8) Fichiers créés ou modifiés (Phase 12 — périmètre réalisé)

| Chemin | Action |
|--------|--------|
| `k8s/base/network-policies/default-deny.yaml` | Créé |
| `k8s/base/network-policies/allow-ingress-to-services.yaml` | Créé |
| `k8s/base/network-policies/allow-services-to-db.yaml` | Créé |
| `k8s/base/network-policies/allow-egress-dns.yaml` | Créé |
| `k8s/base/network-policies/allow-egress-within-namespace.yaml` | Créé |
| `k8s/base/auth/deployment.yaml` | Modifié (`securityContext`, `imagePullPolicy`, `imagePullSecrets`, volume `/tmp`) |
| `k8s/base/profiles/deployment.yaml` | Idem |
| `k8s/base/messaging/deployment.yaml` | Idem |
| `k8s/base/front/deployment.yaml` | Modifié (`securityContext`, `imagePullSecrets`, `imagePullPolicy`) |
| `k8s/base/nginx/deployment.yaml` | Modifié (`securityContext`) |
| Secret K8s `dockerhub-credentials` (namespace `chat-app`) | Créé côté cluster (non versionné — contient des credentials) |

Let me fix the typo in the report file.
</think>


<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace