# Phase 14 — Fonctionnalités applicatives

## Objectif
Enrichir l'application Chat App avec des fonctionnalités métier avancées : groupes de chat, notifications, recherche, et export de données. Chaque fonctionnalité implique des modifications dans les services backend et le front React.

---

## Questions de compréhension avant de commencer
- Quelle est la différence entre une room et un groupe dans un chat ?
- Comment gérer les membres d'un groupe dans la BDD ?
- Comment implémenter une recherche full-text dans PostgreSQL ?
- Qu'est-ce qu'une notification in-app ? Comment la pousser en temps réel via Socket.io ?
- Quel format utiliser pour l'export de données (JSON, CSV) ?

---

## Architecture des nouvelles fonctionnalités

```
Front (React)
    │
    ├── Groupes       → messaging service (rooms avec membres)
    ├── Notifications → messaging service (events Socket.io + table BDD)
    ├── Recherche     → auth/profiles/messaging (endpoints /search)
    └── Export        → API REST → fichier JSON ou CSV
```

---

## 14.1 Groupes de chat

### Modifications BDD (scripts/init-db.sql)

```sql
-- Table groupes
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table membres du groupe
CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
```

### Nouveaux endpoints (service messaging)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/groups` | Créer un groupe |
| GET | `/groups` | Lister les groupes de l'utilisateur |
| POST | `/groups/:groupId/members` | Ajouter un membre |
| DELETE | `/groups/:groupId/members/:userId` | Retirer un membre |
| GET | `/groups/:groupId/messages` | Historique du groupe |

### Front React — Modifications

- Page `Groups.jsx` : liste des groupes, création, gestion des membres
- Composant `Chat.jsx` : sélection entre room et groupe
- Socket.io : événements `join_group`, `send_group_message`

---

## 14.2 Notifications in-app

### Modifications BDD

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,  -- 'new_message', 'group_invite', etc.
  content TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Endpoints (service messaging)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/notifications` | Lister les notifications de l'utilisateur |
| PUT | `/notifications/:id/read` | Marquer comme lue |
| DELETE | `/notifications/:id` | Supprimer une notification |

### Temps réel avec Socket.io

```javascript
// Émettre une notification à un utilisateur spécifique
io.to(userId).emit('notification', {
  type: 'new_message',
  content: `Nouveau message dans ${roomId}`,
  from: senderId
});
```

### Front React

- Badge de notification dans le header (compteur non lus)
- Liste déroulante des notifications récentes
- Mise à jour en temps réel via Socket.io

---

## 14.3 Recherche

### Recherche full-text PostgreSQL

```sql
-- Ajouter un index GIN pour la recherche full-text
CREATE INDEX messages_content_idx ON messages USING gin(to_tsvector('french', content));
```

### Endpoints de recherche

| Service | Route | Description |
|---------|-------|-------------|
| auth | `GET /auth/search?q=` | Rechercher des utilisateurs |
| profiles | `GET /profiles/search?q=` | Rechercher des profils |
| messaging | `GET /messages/search?q=&roomId=` | Rechercher dans les messages |

### Exemple d'implémentation (messaging)

```javascript
router.get('/search', authMiddleware, async (req, res) => {
  const { q, roomId } = req.query;
  const result = await pool.query(
    `SELECT * FROM messages
     WHERE room_id = $1
     AND to_tsvector('french', content) @@ plainto_tsquery('french', $2)
     ORDER BY created_at DESC LIMIT 50`,
    [roomId, q]
  );
  res.json(result.rows);
});
```

### Front React

- Barre de recherche dans la page Chat
- Résultats mis en évidence dans la liste des messages
- Recherche d'utilisateurs dans la page Profils

---

## 14.4 Export de données

### Endpoints d'export

| Route | Format | Description |
|-------|--------|-------------|
| `GET /messages/export?roomId=&format=json` | JSON | Export des messages d'une room |
| `GET /messages/export?roomId=&format=csv` | CSV | Export CSV des messages |
| `GET /profiles/export` | JSON | Export du profil utilisateur |

### Exemple d'implémentation (export CSV)

```javascript
const { Parser } = require('json2csv');

router.get('/export', authMiddleware, async (req, res) => {
  const { roomId, format } = req.query;
  const result = await pool.query(
    'SELECT sender_id, content, created_at FROM messages WHERE room_id = $1 ORDER BY created_at ASC',
    [roomId]
  );

  if (format === 'csv') {
    const parser = new Parser({ fields: ['sender_id', 'content', 'created_at'] });
    const csv = parser.parse(result.rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('messages.csv');
    return res.send(csv);
  }

  res.json(result.rows);
});
```

```bash
# Installer la dépendance CSV
npm install json2csv
```

### Front React

- Bouton "Exporter" dans la page Chat
- Choix du format (JSON / CSV)
- Téléchargement automatique du fichier

---

## 14.5 Mise à jour des tests

Chaque nouvelle fonctionnalité doit être couverte par des tests :

```bash
# Lancer les tests après chaque modification
npm run test:coverage
```

Tests à créer :
- `groups.test.js` : CRUD groupes, ajout/retrait membres
- `notifications.test.js` : création, marquage lu
- `search.test.js` : recherche messages et utilisateurs
- `export.test.js` : format JSON et CSV

---

## Critères de validation
- [ ] CRUD groupes fonctionnel (création, membres, messages)
- [ ] Notifications créées et reçues en temps réel via Socket.io
- [ ] Recherche full-text opérationnelle dans les messages
- [ ] Export JSON et CSV fonctionnel
- [ ] Tests couvrant les nouvelles fonctionnalités
- [ ] Front React mis à jour pour afficher les nouvelles fonctionnalités
- [ ] Images Docker rebuildées et déployées via Helm
