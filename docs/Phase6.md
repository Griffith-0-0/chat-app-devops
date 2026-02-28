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

## 6.1 Lancer Jenkins dans Docker

Créer `jenkins/docker-compose.jenkins.yml` :
```yaml
version: '3.8'
services:
  jenkins:
    image: jenkins/jenkins:lts
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

> ⚠️ Monter `/var/run/docker.sock` permet à Jenkins de lancer des commandes Docker depuis le container. Pourquoi est-ce nécessaire ici ? Demande à Cursor.

```bash
docker-compose -f jenkins/docker-compose.jenkins.yml up -d
# Accéder à Jenkins sur http://localhost:8080
```

---

## 6.2 Configuration Jenkins

### Plugins à installer
- Git Plugin
- GitHub Integration Plugin
- Docker Pipeline Plugin
- SonarQube Scanner Plugin
- Pipeline Plugin

### Credentials à configurer dans Jenkins
| ID | Type | Description |
|----|------|-------------|
| `dockerhub-credentials` | Username/Password | Docker Hub login |
| `github-token` | Secret text | GitHub Personal Access Token |
| `sonar-token` | Secret text | SonarCloud token |

---

## 6.3 Webhook GitHub → Jenkins

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

## 6.4 Jenkinsfile

Créer `Jenkinsfile` à la racine du monorepo :

```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_HUB_USER = 'ton-username'
        SERVICES = 'auth messaging profiles front'
    }

    stages {
        
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Detect Changed Services') {
            steps {
                script {
                    def changedFiles = sh(
                        script: "git diff --name-only HEAD~1 HEAD",
                        returnStdout: true
                    ).trim()
                    
                    env.BUILD_AUTH      = changedFiles.contains('services/auth') ? 'true' : 'false'
                    env.BUILD_MESSAGING = changedFiles.contains('services/messaging') ? 'true' : 'false'
                    env.BUILD_PROFILES  = changedFiles.contains('services/profiles') ? 'true' : 'false'
                    env.BUILD_FRONT     = changedFiles.contains('front') ? 'true' : 'false'
                    
                    echo "Build auth: ${env.BUILD_AUTH}"
                    echo "Build messaging: ${env.BUILD_MESSAGING}"
                }
            }
        }

        stage('Install & Lint') {
            parallel {
                stage('Auth') {
                    when { environment name: 'BUILD_AUTH', value: 'true' }
                    steps {
                        dir('services/auth') {
                            sh 'npm ci'
                            sh 'npm run lint'
                        }
                    }
                }
                stage('Messaging') {
                    when { environment name: 'BUILD_MESSAGING', value: 'true' }
                    steps {
                        dir('services/messaging') {
                            sh 'npm ci'
                            sh 'npm run lint'
                        }
                    }
                }
                // Ajouter profiles et front de la même façon
            }
        }

        stage('Tests & Coverage') {
            parallel {
                stage('Auth Tests') {
                    when { environment name: 'BUILD_AUTH', value: 'true' }
                    steps {
                        dir('services/auth') {
                            sh 'npm run test:coverage'
                        }
                    }
                }
                // Idem pour les autres services
            }
        }

        stage('SonarCloud Analysis') {
            steps {
                withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    sh '''
                        sonar-scanner \
                          -Dsonar.login=$SONAR_TOKEN
                    '''
                }
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    if (env.BUILD_AUTH == 'true') {
                        sh "docker build -t ${DOCKER_HUB_USER}/chat-auth:${BUILD_NUMBER} ./services/auth"
                    }
                    // Idem pour les autres services
                }
            }
        }

        stage('Trivy Security Scan') {
            steps {
                script {
                    if (env.BUILD_AUTH == 'true') {
                        sh "trivy image --exit-code 1 --severity CRITICAL ${DOCKER_HUB_USER}/chat-auth:${BUILD_NUMBER}"
                    }
                }
            }
        }

        stage('Docker Push') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                    script {
                        if (env.BUILD_AUTH == 'true') {
                            sh "docker push ${DOCKER_HUB_USER}/chat-auth:${BUILD_NUMBER}"
                        }
                    }
                }
            }
        }

        stage('Update Helm Values') {
            steps {
                script {
                    if (env.BUILD_AUTH == 'true') {
                        sh "sed -i 's/tag: .*/tag: ${BUILD_NUMBER}/' helm/auth/values.yaml"
                    }
                    sh '''
                        git config user.email "jenkins@chatapp.com"
                        git config user.name "Jenkins"
                        git add helm/*/values.yaml
                        git commit -m "ci: update image tags [skip ci]"
                        git push
                    '''
                }
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline terminé avec succès'
        }
        failure {
            echo '❌ Pipeline en échec'
        }
    }
}
```

---

## 6.5 Installer Trivy sur Jenkins

```bash
# Depuis le container Jenkins
docker exec -it jenkins_container bash
apt-get install wget -y
wget -qO- https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh
```

---

## Critères de validation
- [ ] Jenkins accessible sur http://localhost:8080
- [ ] Webhook GitHub fonctionnel (push → pipeline se déclenche)
- [ ] Le pipeline détecte correctement les services modifiés
- [ ] Les stages `parallel` fonctionnent
- [ ] Les images sont pushées sur Docker Hub
- [ ] Trivy bloque le pipeline si vulnérabilité critique détectée
- [ ] Les `values.yaml` Helm sont mis à jour automatiquement
- [ ] Pipeline vert de bout en bout sur `main`