# Phase 4 — Tests

## Objectif
Écrire des tests automatisés pour chaque service avec Jest et Supertest, et atteindre un coverage minimum de 70%.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre test unitaire, test d'intégration et test E2E ?
- Pourquoi mocker la BDD dans les tests unitaires ?
- Qu'est-ce que le code coverage et pourquoi 70% est un bon seuil de départ ?
- Pourquoi les tests sont critiques dans un pipeline CI ?

---

## Ce que tu vas faire

### Par service, tu vas écrire :

| Type | Ce qu'on teste | Outil |
|------|---------------|-------|
| **Unit tests** | Fonctions isolées (hash password, generate token...) | Jest |
| **Integration tests** | Routes HTTP avec vraie BDD de test | Jest + Supertest |
| **Coverage** | Rapport de couverture du code | Jest --coverage |

---

## Setup Jest

Dans chaque service, installer :
```bash
npm install --save-dev jest supertest @types/jest
```

`package.json` de chaque service :
```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageThreshold": {
      "global": {
        "lines": 70,
        "functions": 70
      }
    }
  }
}
```

---

## Tests à écrire par service

### Service Auth
```
tests/
├── unit/
│   ├── hashPassword.test.js      — bcrypt hash/compare
│   ├── generateToken.test.js     — JWT generate/verify
│   └── validateInput.test.js     — validation des inputs
└── integration/
    ├── register.test.js          — POST /auth/register
    ├── login.test.js             — POST /auth/login
    └── logout.test.js            — POST /auth/logout
```

### Service Profiles
```
tests/
├── unit/
│   └── profileValidator.test.js
└── integration/
    ├── getProfile.test.js        — GET /profiles/:id
    └── updateProfile.test.js     — PUT /profiles/:id
```

### Service Messaging
```
tests/
├── unit/
│   ├── messageFormatter.test.js
│   └── roomValidator.test.js
└── integration/
    └── getMessages.test.js       — GET /messages/:roomId
```

---

## Bonnes pratiques

### Isolation des tests
- Utiliser une **BDD de test séparée** (ex: `auth_test_db`)
- Nettoyer la BDD avant/après chaque test (`beforeEach`, `afterAll`)
- Mocker les services externes (Redis, RabbitMQ) dans les tests unitaires

### Structure d'un bon test
```javascript
describe('POST /auth/register', () => {
  it('should create a user and return 201', async () => {
    // Arrange
    const payload = { username: 'test', email: 'test@test.com', password: 'Pass123!' }
    
    // Act
    const res = await request(app).post('/auth/register').send(payload)
    
    // Assert
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('userId')
  })

  it('should return 400 if email already exists', async () => {
    // ...
  })
})
```

---

## Variables d'environnement pour les tests

Créer un fichier `.env.test` dans chaque service :
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/auth_test_db
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test_secret
```

---

## Commandes
```bash
# Lancer les tests
npm test

# Lancer avec coverage
npm run test:coverage

# Voir le rapport coverage (ouvre dans le navigateur)
open coverage/lcov-report/index.html
```

---

## Critères de validation
- [ ] Tests unitaires écrits pour les fonctions critiques
- [ ] Tests d'intégration pour toutes les routes HTTP
- [ ] Coverage > 70% sur chaque service
- [ ] Les tests passent dans un environnement isolé (BDD de test)
- [ ] `npm test` retourne exit code 0 (aucun test en échec)
- [ ] Les tests s'exécutent en moins de 30 secondes par service