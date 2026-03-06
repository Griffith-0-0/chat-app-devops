# Phase 5 — Qualité de code

## Objectif
Configurer SonarCloud pour analyser la qualité du code et Dependabot pour surveiller les dépendances vulnérables.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre un bug, un code smell et une vulnérabilité dans SonarCloud ?
- Qu'est-ce qu'un "Quality Gate" ?
- Pourquoi surveiller les dépendances npm est important en sécurité ?

---

## 5.1 SonarCloud

### Setup
1. Aller sur [sonarcloud.io](https://sonarcloud.io) et se connecter avec GitHub
2. Créer une organisation et importer le repo `chat-app`
3. Récupérer le `SONAR_TOKEN` → l'ajouter dans les secrets GitHub

### Fichier de config par service

Créer `sonar-project.properties` dans chaque service :
```properties
sonar.projectKey=chat-app_auth
sonar.projectName=Chat App - Auth Service
sonar.sources=src
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.exclusions=node_modules/**,coverage/**
sonar.host.url=https://sonarcloud.io
sonar.organization=griffith-0-0
```

> **Note** : `sonar.tests=tests` peut provoquer des erreurs dans certains contextes (Jenkins-in-Docker). L'omettre si nécessaire ; SonarCloud détecte les tests via les patterns de nommage et le rapport lcov.

### Quality Gate à configurer
Dans SonarCloud, s'assurer que le Quality Gate vérifie :
- Coverage > 70%
- 0 bug bloquant
- 0 vulnérabilité critique
- Duplications < 3%

---

## 5.2 ESLint

### Config ESLint (flat config — ESLint 9+)

Avec `eslint.config.mjs` (format flat config) :
```javascript
import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },  // process, Buffer, describe, it, expect
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'   // catch (_err) accepté
      }],
    },
  },
  pluginJs.configs.recommended,
];
```

> **Important** : `globals.node` et `globals.jest` évitent les erreurs `'process' is not defined` et `'Buffer' is not defined`. `caughtErrorsIgnorePattern: '^_'` permet les blocs `catch (_err)` lorsque la variable n'est pas utilisée.

### Scripts npm à ajouter
```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  }
}
```

---

## 5.3 Dependabot

Créer `.github/dependabot.yml` à la racine du monorepo :
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/services/auth"
    schedule:
      interval: "weekly"
    
  - package-ecosystem: "npm"
    directory: "/services/messaging"
    schedule:
      interval: "weekly"

  - package-ecosystem: "npm"
    directory: "/services/profiles"
    schedule:
      interval: "weekly"

  - package-ecosystem: "npm"
    directory: "/front"
    schedule:
      interval: "weekly"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## Critères de validation
- [ ] SonarCloud analyse les 3 services
- [ ] Quality Gate configuré et actif
- [ ] ESLint configuré avec 0 erreur sur le code existant
- [ ] Dependabot activé sur les 4 packages npm + Docker
- [ ] Le rapport SonarCloud est visible sur sonarcloud.io