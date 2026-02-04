# 🚀 Démarrage Rapide

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env.local` :

```env
ASSEMBLYAI_API_KEY=votre_cle_api_assemblyai
NEXT_PUBLIC_API_URL=http://localhost:5005
```

## Lancement

### Option 1 : Les deux serveurs en même temps

```bash
npm run dev:all
```

### Option 2 : Séparément (2 terminaux)

**Terminal 1 - Frontend :**
```bash
npm run dev
```

**Terminal 2 - Backend :**
```bash
npm run dev:backend
```

## Accès

- **Frontend** : http://localhost:3005
- **Backend API** : http://localhost:5005

## Vérification

1. Ouvrez http://localhost:3005 dans votre navigateur
2. Vérifiez que le backend répond : http://localhost:5005/api/history
3. Vous devriez voir `[]` (historique vide)

## Problèmes courants

- **Erreur CORS** : Vérifiez que le backend tourne sur le port 5005
- **Erreur 500** : Vérifiez que `ASSEMBLYAI_API_KEY` est bien configurée dans `.env.local`
- **Port déjà utilisé** : Changez les ports dans `package.json` et `.env.local`

