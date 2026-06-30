# Phase 12 — Sécurité (terminée le 6 juin 2026)

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
- scan des images avec Trivy dans Jenkins et scan planifié Kubernetes ;
- RBAC minimal pour Jenkins.

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
| Credentials BDD/RabbitMQ retirés des `ConfigMap` | Oui, centralisés dans `app-secrets` |
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

1. **Registry privée / credentials** : si les images Docker Hub sont privées, créer côté cluster un secret `docker-registry` `dockerhub-credentials` dans `chat-app` (non versionné, car il contient des credentials).
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
| `k8s/base/app-secrets.yaml` | Créé : `DATABASE_URL`, `POSTGRES_PASSWORD`, `RABBITMQ_URL`, `RABBITMQ_DEFAULT_PASS` |
| `k8s/base/auth/configmap.yaml` | Nettoyé : retrait de `DATABASE_URL` sensible |
| `k8s/base/profiles/configmap.yaml` | Nettoyé : retrait de `DATABASE_URL` sensible |
| `k8s/base/messaging/configmap.yaml` | Nettoyé : retrait de `DATABASE_URL` et `RABBITMQ_URL` sensibles |
| `k8s/base/auth/deployment.yaml` | Modifié (`securityContext`, `imagePullPolicy`, volume `/tmp`) |
| `k8s/base/profiles/deployment.yaml` | Idem |
| `k8s/base/messaging/deployment.yaml` | Idem |
| `k8s/base/postgres/statefulset.yaml` | Modifié : `POSTGRES_PASSWORD` lu depuis `app-secrets` |
| `k8s/base/rabbitmq/deployment.yaml` | Modifié : `RABBITMQ_DEFAULT_PASS` lu depuis `app-secrets` |
| `k8s/base/front/deployment.yaml` | Modifié (`securityContext`, `imagePullPolicy`) |
| `k8s/base/nginx/deployment.yaml` | Modifié (`securityContext`) |
| `k8s/base/monitoring/trivy-cronjob.yaml` | Créé : scan planifié HIGH/CRITICAL des images applicatives |
| `k8s/base/rbac/jenkins-rbac.yaml` | Créé : ServiceAccount, Role et RoleBinding Jenkins avec permissions limitées |
| `k8s/base/kustomization.yaml` | Mis à jour pour appliquer Network Policies, RBAC et CronJob Trivy |

---

## 9) Trivy — scan continu des images

Deux niveaux de scan sont en place :

| Niveau | Implémentation | Comportement |
|--------|----------------|--------------|
| Pipeline Jenkins | `Jenkinsfile`, stage `Trivy Security Scan` | Bloque le pipeline si une vulnérabilité `CRITICAL` est détectée avant le push |
| Kubernetes planifié | `k8s/base/monitoring/trivy-cronjob.yaml` | Lance un scan nocturne des images `auth`, `profiles`, `messaging` et `front` |

Le CronJob utilise `--exit-code=0` pour produire un résultat d'audit régulier sans casser le cluster. Le blocage reste volontairement porté par Jenkins, avant publication et déploiement.

---

## 10) RBAC Jenkins

Le fichier `k8s/base/rbac/jenkins-rbac.yaml` crée :

- un `ServiceAccount` `jenkins` dans le namespace `chat-app` ;
- un `Role` limité à la lecture des objets utiles et à la mise à jour/patch des `deployments` ;
- un `RoleBinding` qui associe Jenkins à ce rôle.

Cette configuration applique le principe du moindre privilège : Jenkins peut déployer/mettre à jour les workloads applicatifs sans recevoir de droits administrateur sur tout le cluster.

---

## 11) Critères de validation Phase 12

| Critère | Statut |
|---------|--------|
| Aucun `.env` suivi par Git et `.env` ignoré dans `.gitignore` | ✅ |
| Secrets sensibles placés dans des objets `Secret` K8s ou credentials externes | ✅ |
| Aucun credential applicatif dans les `ConfigMap` | ✅ |
| Network Policies appliquées dans `k8s/base/network-policies/` | ✅ |
| Default deny ingress/egress + règles DNS et intra-namespace documentées | ✅ |
| Le front ne peut pas parler directement à PostgreSQL | ✅ |
| `securityContext` durci sur `auth`, `profiles`, `messaging` | ✅ |
| Compromis documenté pour les images Nginx (`front`, `nginx`) | ✅ |
| Trivy bloque les vulnérabilités critiques dans Jenkins | ✅ |
| CronJob Trivy planifié ajouté au socle K8s | ✅ |
| RBAC Jenkins ajouté avec permissions limitées | ✅ |

---

## 12) Conclusion

La Phase 12 est terminée côté repository : secrets, isolation réseau, durcissement des conteneurs, scan de vulnérabilités et RBAC Jenkins sont documentés et versionnés.

La suite logique est la **Phase 13 — Multi-environnements (dev / staging / prod)**.
