
// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const os = require("os");
const crypto = require("crypto");
const { Pool } = require('pg');
const { createReadStream } = require("fs");
const ytdl = require('ytdl-core'); // Ajout de la dépendance

// ... (le reste du code de configuration reste identique)
// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS history (
        id UUID PRIMARY KEY,
        type VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        language VARCHAR(10),
        language_codes VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3005",
  "http://localhost:3000",
].filter(Boolean);

const corsOptions = {
  credentials: true,
  origin: function (origin, callback) {
    if (!process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());

// Configuration multer pour le streaming (stockage temporaire sur disque)
const upload = multer({ dest: os.tmpdir() });

const ASSEMBLYAI_UPLOAD_URL = "https://api.assemblyai.com/v2/upload";
const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2/transcript";

const API_KEY_FILE = path.join(process.cwd(), "config", "api-key.json");
const ENV_FILE = path.join(process.cwd(), ".env.local");

async function getApiKey() {
  // ... (code inchangé)
}

async function saveApiKey(apiKey) {
  // ... (code inchangé)
}

// --- NOUVELLE ROUTE POUR YOUTUBE ---
app.post("/api/youtube/info", async (req, res) => {
  const { url } = req.body;
  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({ error: "URL YouTube invalide" });
  }

  try {
    const info = await ytdl.getInfo(url);
    const audioFormat = ytdl.chooseFormat(info.formats, { 
      quality: 'highestaudio',
      filter: 'audioonly' 
    });
    
    if (!audioFormat) {
      return res.status(404).json({ error: "Aucun format audio trouvé pour cette vidéo." });
    }

    res.json({ 
      audioUrl: audioFormat.url, 
      title: info.videoDetails.title 
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des informations YouTube:", error);
    res.status(500).json({ error: `Erreur serveur: Impossible d'obtenir les informations de la vidéo.` });
  }
});

// ... (le reste des routes API reste identique)

app.listen(PORT, async () => {
  await initializeDatabase();
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/api/infos`);
});

