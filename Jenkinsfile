pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'badrkhafif98'
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
                        script: "git diff --name-only HEAD~1 HEAD 2>/dev/null || git ls-files",
                        returnStdout: true
                    ).trim()
                    
                    env.BUILD_AUTH      = changedFiles.contains('services/auth')     ? 'true' : 'false'
                    env.BUILD_PROFILES  = changedFiles.contains('services/profiles') ? 'true' : 'false'
                    env.BUILD_MESSAGING = changedFiles.contains('services/messaging')? 'true' : 'false'
                    env.BUILD_FRONT     = changedFiles.contains('front/')            ? 'true' : 'false'
                    
                    echo "Build auth: ${env.BUILD_AUTH}"
                    echo "Build profiles: ${env.BUILD_PROFILES}"
                    echo "Build messaging: ${env.BUILD_MESSAGING}"
                    echo "Build front: ${env.BUILD_FRONT}"
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
                stage('Profiles') {
                    when { environment name: 'BUILD_PROFILES', value: 'true' }
                    steps {
                        dir('services/profiles') {
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
                stage('Front') {
                    when { environment name: 'BUILD_FRONT', value: 'true' }
                    steps {
                        dir('front') {
                            sh 'npm ci'
                            sh 'npm run lint'
                        }
                    }
                }
            }
        }        
        stage('Tests & Coverage') {
            parallel {
                stage('Auth Tests') {
                    when { environment name: 'BUILD_AUTH', value: 'true' }
                    steps {
                        dir('services/auth') {
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
                        }
                    }
                }
                stage('Profiles Tests') {
                    when { environment name: 'BUILD_PROFILES', value: 'true' }
                    steps {
                        dir('services/profiles') {
                            withEnv([
                                'DATABASE_URL=postgresql://user:password@host.docker.internal:5432/chat_db',
                                'AUTH_SERVICE_URL=http://localhost:3001'
                            ]) {
                                sh 'npm run test:coverage'
                            }
                        }
                    }
                }
                stage('Messaging Tests') {
                    when { environment name: 'BUILD_MESSAGING', value: 'true' }
                    steps {
                        dir('services/messaging') {
                            withEnv([
                                'DATABASE_URL=postgresql://user:password@host.docker.internal:5432/chat_db',
                                'REDIS_URL=redis://host.docker.internal:6379',
                                'AUTH_SERVICE_URL=http://localhost:3001'
                            ]) {
                                sh 'npm run test:coverage'
                            }
                        }
                    }
                }
            }
        }
                stage('SonarCloud Analysis') {
            steps {
                withCredentials([string(credentialsId: 'SONAR_TOKEN', variable: 'SONAR_TOKEN')]) {
                    sh '''
                        docker run --rm --platform linux/amd64 \
                          -v $PWD:/usr/src -w /usr/src \
                          -e SONAR_TOKEN=$SONAR_TOKEN \
                          sonarsource/sonar-scanner-cli \
                          sonar-scanner \
                          -Dsonar.projectKey=chat-app_auth \
                          -Dsonar.organization=griffith-0-0 \
                          -Dsonar.host.url=https://sonarcloud.io \
                          -Dsonar.sources=services/auth/src \
                          -Dsonar.tests=services/auth/tests \
                          -Dsonar.javascript.lcov.reportPaths=services/auth/coverage/lcov.info \
                          -Dsonar.projectBaseDir=/usr/src
                        docker run --rm --platform linux/amd64 \
                          -v $PWD:/usr/src -w /usr/src \
                          -e SONAR_TOKEN=$SONAR_TOKEN \
                          sonarsource/sonar-scanner-cli \
                          sonar-scanner \
                          -Dsonar.projectKey=chat-app_profiles \
                          -Dsonar.organization=griffith-0-0 \
                          -Dsonar.host.url=https://sonarcloud.io \
                          -Dsonar.sources=services/profiles/src \
                          -Dsonar.tests=services/profiles/tests \
                          -Dsonar.javascript.lcov.reportPaths=services/profiles/coverage/lcov.info \
                          -Dsonar.projectBaseDir=/usr/src
                        docker run --rm --platform linux/amd64 \
                          -v $PWD:/usr/src -w /usr/src \
                          -e SONAR_TOKEN=$SONAR_TOKEN \
                          sonarsource/sonar-scanner-cli \
                          sonar-scanner \
                          -Dsonar.projectKey=chat-app_messaging \
                          -Dsonar.organization=griffith-0-0 \
                          -Dsonar.host.url=https://sonarcloud.io \
                          -Dsonar.sources=services/messaging/src \
                          -Dsonar.tests=services/messaging/tests \
                          -Dsonar.javascript.lcov.reportPaths=services/messaging/coverage/lcov.info \
                          -Dsonar.projectBaseDir=/usr/src
                    '''
                }
            }
        }
        stage('Docker Build') {
            steps {
                script {
                    if (env.BUILD_AUTH == 'true') {
                        sh "docker build -t ${env.DOCKER_HUB_USER}/chat-auth:${env.BUILD_NUMBER} ./services/auth"
                    }
                    if (env.BUILD_PROFILES == 'true') {
                        sh "docker build -t ${env.DOCKER_HUB_USER}/chat-profiles:${env.BUILD_NUMBER} ./services/profiles"
                    }
                    if (env.BUILD_MESSAGING == 'true') {
                        sh "docker build -t ${env.DOCKER_HUB_USER}/chat-messaging:${env.BUILD_NUMBER} ./services/messaging"
                    }
                    if (env.BUILD_FRONT == 'true') {
                        sh "docker build -t ${env.DOCKER_HUB_USER}/chat-front:${env.BUILD_NUMBER} ./front"
                    }
                }
            }
        }
        stage('Trivy Security Scan') {
            steps {
                script {
                    if (env.BUILD_AUTH == 'true') {
                        sh "trivy image --exit-code 1 --severity CRITICAL ${env.DOCKER_HUB_USER}/chat-auth:${env.BUILD_NUMBER}"
                    }
                    if (env.BUILD_PROFILES == 'true') {
                        sh "trivy image --exit-code 1 --severity CRITICAL ${env.DOCKER_HUB_USER}/chat-profiles:${env.BUILD_NUMBER}"
                    }
                    if (env.BUILD_MESSAGING == 'true') {
                        sh "trivy image --exit-code 1 --severity CRITICAL ${env.DOCKER_HUB_USER}/chat-messaging:${env.BUILD_NUMBER}"
                    }
                    if (env.BUILD_FRONT == 'true') {
                        sh "trivy image --exit-code 1 --severity CRITICAL ${env.DOCKER_HUB_USER}/chat-front:${env.BUILD_NUMBER}"
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
                            sh "docker push ${env.DOCKER_HUB_USER}/chat-auth:${env.BUILD_NUMBER}"
                        }
                        if (env.BUILD_PROFILES == 'true') {
                            sh "docker push ${env.DOCKER_HUB_USER}/chat-profiles:${env.BUILD_NUMBER}"
                        }
                        if (env.BUILD_MESSAGING == 'true') {
                            sh "docker push ${env.DOCKER_HUB_USER}/chat-messaging:${env.BUILD_NUMBER}"
                        }
                        if (env.BUILD_FRONT == 'true') {
                            sh "docker push ${env.DOCKER_HUB_USER}/chat-front:${env.BUILD_NUMBER}"
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline terminé avec succès'
        }
        failure {
            echo 'Pipeline en échec'
        }
    }
}