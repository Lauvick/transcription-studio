# 🚀 Guide de Déploiement Gratuit

Ce guide vous explique comment déployer gratuitement votre application Transcription Studio sur internet.

## 📋 Options de Déploiement Gratuit

### Option 1 : Vercel (Frontend) + Railway (Backend) ⭐ RECOMMANDÉ

#### Frontend sur Vercel (Gratuit)

1. **Créer un compte sur Vercel** : https://vercel.com

2. **Installer Vercel CLI** :
```bash
npm install -g vercel
```

3. **Déployer** :
```bash
vercel
```

4. **Configurer les variables d'environnement** dans le dashboard Vercel :
   - `NEXT_PUBLIC_API_URL` : URL de votre backend (ex: `https://votre-app.railway.app`)

#### Backend sur Railway (Gratuit avec crédits)

1. **Créer un compte sur Railway** : https://railway.app

2. **Créer un nouveau projet** → "Deploy from GitHub repo"

3. **Sélectionner votre repo** et Railway détectera automatiquement Node.js

4. **Configurer les variables d'environnement** :
   - `ASSEMBLYAI_API_KEY` : Votre clé API AssemblyAI
   - `PORT` : `5005` (ou laisser Railway assigner automatiquement)

5. **Railway générera automatiquement une URL** pour votre backend

6. **Mettre à jour `NEXT_PUBLIC_API_URL`** dans Vercel avec l'URL Railway

---

### Option 2 : Render (Frontend + Backend) 🆓

#### Frontend sur Render

1. **Créer un compte** : https://render.com

2. **Nouveau → Web Service**

3. **Connecter votre repo GitHub**

4. **Configuration** :
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Environment** : `Node`
   - **Plan** : Free

5. **Variables d'environnement** :
   - `NEXT_PUBLIC_API_URL` : URL de votre backend Render

#### Backend sur Render

1. **Nouveau → Web Service**

2. **Configuration** :
   - **Build Command** : `npm install`
   - **Start Command** : `node server/index.js`
   - **Environment** : `Node`
   - **Plan** : Free

3. **Variables d'environnement** :
   - `ASSEMBLYAI_API_KEY` : Votre clé API
   - `PORT` : Render assigne automatiquement (utiliser `process.env.PORT`)

---

### Option 3 : Netlify (Frontend) + Fly.io (Backend)

#### Frontend sur Netlify

1. **Créer un compte** : https://netlify.com

2. **Nouveau site depuis Git** → Connecter votre repo

3. **Configuration** :
   - Build command : `npm run build`
   - Publish directory : `.next`

4. **Variables d'environnement** :
   - `NEXT_PUBLIC_API_URL` : URL de votre backend

#### Backend sur Fly.io

1. **Installer Fly CLI** : https://fly.io/docs/getting-started/installing-flyctl/

2. **Créer un compte** : `fly auth signup`

3. **Déployer** :
```bash
fly launch
```

---

## 🔧 Modifications Nécessaires pour le Déploiement

### 1. Modifier le backend pour utiliser le PORT dynamique

Le fichier `server/index.js` doit utiliser `process.env.PORT` :

```javascript
const PORT = process.env.PORT || 5005;
```

### 2. Modifier le frontend pour l'URL dynamique

Dans `app/page.tsx`, l'URL doit être configurable :

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005";
```

### 3. Gérer le stockage de l'historique

Pour le déploiement, vous avez deux options :

**Option A : Utiliser une base de données gratuite**
- MongoDB Atlas (gratuit) : https://www.mongodb.com/cloud/atlas
- Supabase (gratuit) : https://supabase.com
- PlanetScale (gratuit) : https://planetscale.com

**Option B : Utiliser le système de fichiers (limité)**
- Le fichier JSON fonctionne mais est perdu à chaque redéploiement
- Utilisez un volume persistant si disponible (Railway, Render)

---

## 📝 Checklist de Déploiement

- [ ] Créer les comptes sur les plateformes choisies
- [ ] Configurer les variables d'environnement
- [ ] Modifier le backend pour utiliser `process.env.PORT`
- [ ] Tester l'application en local avec les variables de production
- [ ] Déployer le backend et noter l'URL
- [ ] Configurer `NEXT_PUBLIC_API_URL` dans le frontend
- [ ] Déployer le frontend
- [ ] Tester l'application déployée
- [ ] Vérifier que l'historique fonctionne (ou migrer vers une DB)

---

## 🆓 Limites des Plans Gratuits

### Vercel
- ✅ Illimité pour projets personnels
- ✅ Déploiements automatiques
- ⚠️ Limite de bande passante (100 GB/mois)

### Railway
- ✅ $5 de crédits gratuits/mois
- ⚠️ S'arrête après épuisement des crédits

### Render
- ✅ 750 heures gratuites/mois
- ⚠️ S'endort après 15 min d'inactivité (gratuit)

### Netlify
- ✅ 100 GB de bande passante/mois
- ✅ Déploiements illimités

---

## 🔐 Sécurité

⚠️ **Important** : Ne commitez JAMAIS vos clés API dans Git !

- Utilisez les variables d'environnement des plateformes
- Ajoutez `.env.local` dans `.gitignore` (déjà fait)
- Vérifiez que `ASSEMBLYAI_API_KEY` n'est jamais exposée côté client

---

## 🐛 Dépannage

### CORS Errors
Si vous avez des erreurs CORS, ajoutez l'URL du frontend dans la configuration CORS du backend.

### Backend inaccessible
Vérifiez que le backend écoute sur `0.0.0.0` et non `localhost`.

### Variables d'environnement
Vérifiez que toutes les variables sont bien configurées dans les deux plateformes.

