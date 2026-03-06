# Phase 6 — Jenkins

## Objectif
Mettre en place un pipeline CI/CD complet avec Jenkins qui se déclenche automatiquement à chaque push GitHub.

---

## Questions de compréhension avant de commencer
- Qu'est-ce qu'un webhook et comment ça fonctionne entre GitHub et Jenkins ?
- Quelle est la différence entre un pipeline déclaratif et un pipeline scripté dans Jenkins ?
- Pourquoi détecter quel service a changé dans un monorepo ?
- Qu'est-ce que ngrok et pourquoi en a-t-on besoin en local ?

---

## 6.1 Image Jenkins personnalisée (Dockerfile)

Créer `jenkins/Dockerfile` pour inclure les outils nécessaires au pipeline (Node.js, Docker CLI, Trivy, SonarScanner) :

```dockerfile
FROM jenkins/jenkins:lts

USER root

# Docker CLI (pour build/push)
RUN apt-get update && \
    apt-get install -y ca-certificates curl gnupg && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && apt-get install -y docker-ce-cli

# Node.js 20 (npm ci, lint, test)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

# Trivy (scan sécurité images)
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# SonarScanner (analyse qualité code)
RUN npm install -g sonar-scanner

USER jenkins
```

---

## 6.2 Lancer Jenkins dans Docker

Créer `jenkins/docker-compose.jenkins.yml` :
```yaml
version: '3.8'
services:
  jenkins:
    build:
      context: .
      dockerfile: Dockerfile
    privileged: true
    user: root
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - jenkins_data:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOCKER_HOST=unix:///var/run/docker.sock

volumes:
  jenkins_data:
```

> ⚠️ Monter `/var/run/docker.sock` permet à Jenkins de lancer des commandes Docker depuis le container (build, push). C'est du "Docker-out-of-Docker".

```bash
cd jenkins && docker compose -f docker-compose.jenkins.yml up -d
# Accéder à Jenkins sur http://localhost:8080
```

> **Important** : Postgres et Redis doivent tourner sur l'hôte (ou accessibles via `host.docker.internal`) pour les tests d'intégration. Ex : `docker compose up -d postgres redis` à la racine du projet.

---

## 6.3 Configuration Jenkins

### Plugins à installer
- Git Plugin
- GitHub Integration Plugin
- Docker Pipeline Plugin
- SonarQube Scanner Plugin
- Pipeline Plugin

### Credentials à configurer dans Jenkins (System → Credentials)
| ID | Type | Description |
|----|------|-------------|
| `dockerhub-credentials` | Username/Password | Docker Hub login |
| `github-token` | Secret text | GitHub Personal Access Token |
| `SONAR_TOKEN` | Secret text | SonarCloud token |

---

## 6.4 Webhook GitHub → Jenkins

1. Exposer Jenkins avec ngrok :
```bash
ngrok http 8080
# Copier l'URL https://xxxx.ngrok.io
```

2. Dans GitHub → Settings → Webhooks → Add webhook :
   - Payload URL : `https://xxxx.ngrok.io/github-webhook/`
   - Content type : `application/json`
   - Events : `Push`

---

## 6.5 Jenkinsfile

Créer `Jenkinsfile` à la racine du monorepo. Points clés :

### Detect Changed Services
Fallback `git ls-files` si pas de commit précédent (premier build) :
```groovy
def changedFiles = sh(
    script: "git diff --name-only HEAD~1 HEAD 2>/dev/null || git ls-files",
    returnStdout: true
).trim()
env.BUILD_FRONT = changedFiles.contains('front/') ? 'true' : 'false'  // front/ pour éviter faux positifs
```

### Tests & Coverage
Variables d'environnement requises pour les tests d'intégration (Postgres, Redis sur l'hôte) :
```groovy
withEnv([
    'DATABASE_URL=postgresql://user:password@host.docker.internal:5432/chat_db',
    'REDIS_URL=redis://host.docker.internal:6379',
    'JWT_SECRET=test_secret',
    'JWT_REFRESH_SECRET=test_refresh_secret',
    'JWT_EXPIRES_IN=15m',
    'JWT_REFRESH_EXPIRES_IN=7d'
]) {
    sh 'npm run test:coverage'
}
```

### SonarCloud Analysis
**Important** : En Jenkins-in-Docker, `docker run -v $PWD` échoue (le chemin n'existe pas sur l'hôte). Exécuter `sonar-scanner` directement depuis le workspace :
```groovy
withCredentials([string(credentialsId: 'SONAR_TOKEN', variable: 'SONAR_TOKEN')]) {
    sh '''
        npm install -g sonar-scanner
        (cd services/auth && sonar-scanner)
        (cd services/profiles && sonar-scanner)
        (cd services/messaging && sonar-scanner)
    '''
}
```
Les subshells `(cd ...)` isolent chaque `cd` pour éviter les erreurs en cascade.

### Trivy
Trivy est déjà installé dans le Dockerfile Jenkins. Aucune installation manuelle nécessaire.

### Update Helm Values
Ce stage est optionnel et sera implémenté en Phase 8 (Helm). Ne pas l'inclure tant que les charts Helm ne sont pas en place.

---

## 6.6 Difficultés rencontrées et solutions

| Problème | Solution |
|----------|----------|
| ESLint `'err' is defined but never used` | Renommer `catch (err)` en `catch (_err)` + `caughtErrorsIgnorePattern: '^_'` dans ESLint |
| ESLint `'process'` / `'Buffer'` is not defined | Utiliser `globals.node` + `globals.jest` dans `eslint.config.mjs` (profiles, messaging) |
| SonarCloud : `The folder 'services/auth/tests' does not exist` | En Jenkins-in-Docker, `docker run -v $PWD` monte un chemin inexistant sur l'hôte → exécuter sonar-scanner directement |
| `sonar-scanner: not found` | Ajouter `npm install -g sonar-scanner` avant les appels dans le Jenkinsfile |
| `cd` en cascade échoue après une erreur | Utiliser des subshells : `(cd services/auth && sonar-scanner)` |
| SonarCloud : `sonar.tests` provoque des erreurs | Supprimer `sonar.tests` des `sonar-project.properties` |

Voir `PROGRESS.md` section "Difficultés Jenkins workflow" pour plus de détails.

---

## Critères de validation
- [ ] Jenkins accessible sur http://localhost:8080
- [ ] Image Jenkins buildée avec Node.js, Trivy, SonarScanner
- [ ] Webhook GitHub fonctionnel (push → pipeline se déclenche)
- [ ] Le pipeline détecte correctement les services modifiés
- [ ] Les stages `parallel` (Install & Lint, Tests) fonctionnent
- [ ] Les images sont pushées sur Docker Hub
- [ ] Trivy bloque le pipeline si vulnérabilité CRITICAL détectée
- [ ] Pipeline vert de bout en bout sur `main`