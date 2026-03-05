pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'REMPLACE_PAR_TON_USERNAME_DOCKERHUB'
        SERVICES = 'auth messaging profiles front'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
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