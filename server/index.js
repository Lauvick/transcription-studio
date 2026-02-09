
// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const { Pool } = require('pg');

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
    // Si FRONTEND_URL n'est pas défini, on autorise tout pour les health checks
    if (!process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    // Sinon, on applique la politique stricte
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());

// Configuration multer
const upload = multer({ storage: multer.memoryStorage() });

const ASSEMBLYAI_UPLOAD_URL = "https://api.assemblyai.com/v2/upload";
const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2/transcript";

const API_KEY_FILE = path.join(process.cwd(), "config", "api-key.json");
const ENV_FILE = path.join(process.cwd(), ".env.local");

async function getApiKey() {
  try {
    try {
      const configContent = await fs.readFile(API_KEY_FILE, "utf-8");
      const config = JSON.parse(configContent);
      if (config.ASSEMBLYAI_API_KEY) {
        return config.ASSEMBLYAI_API_KEY;
      }
    } catch (e) {
      // Fichier n'existe pas, continuer
    }

    try {
      const envContent = await fs.readFile(ENV_FILE, "utf-8");
      const lines = envContent.split("\n");
      for (const line of lines) {
        if (line.startsWith("ASSEMBLYAI_API_KEY=")) {
          return line.split("=")[1].trim();
        }
      }
    } catch (e) {
      // Fichier n'existe pas, continuer
    }

    return process.env.ASSEMBLYAI_API_KEY || null;
  } catch (error) {
    console.error("Error reading API key:", error);
    return process.env.ASSEMBLYAI_API_KEY || null;
  }
}

async function saveApiKey(apiKey) {
  try {
    const configDir = path.dirname(API_KEY_FILE);
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }

    await fs.writeFile(
      API_KEY_FILE,
      JSON.stringify({ ASSEMBLYAI_API_KEY: apiKey }, null, 2),
      "utf-8"
    );

    try {
      let envContent = "";
      try {
        envContent = await fs.readFile(ENV_FILE, "utf-8");
      } catch {
        // Fichier n'existe pas, on le crée
      }

      const lines = envContent.split("\n");
      let found = false;
      const newLines = lines.map((line) => {
        if (line.startsWith("ASSEMBLYAI_API_KEY=")) {
          found = true;
          return `ASSEMBLYAI_API_KEY=${apiKey}`;
        }
        return line;
      });

      if (!found) {
        newLines.push(`ASSEMBLYAI_API_KEY=${apiKey}`);
      }

      if (!newLines.some((line) => line.startsWith("NEXT_PUBLIC_API_URL="))) {
        newLines.push("NEXT_PUBLIC_API_URL=http://localhost:5005");
      }

      await fs.writeFile(ENV_FILE, newLines.join("\n"), "utf-8");
    } catch (error) {
      console.error("Error updating .env.local:", error);
    }

    return true;
  } catch (error) {
    console.error("Error saving API key:", error);
    throw error;
  }
}

// Routes de gestion de la clé API
app.get("/api/config/api-key", async (req, res) => {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.json({ apiKey: null, configured: false });
    }
    const masked = apiKey.length > 8 
      ? `${apiKey.substring(0, 4)}${"*".repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`
      : "****";
    res.json({ apiKey: masked, configured: true, fullLength: apiKey.length });
  } catch (error) {
    console.error("Error getting API key:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.post("/api/config/api-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return res.status(400).json({ error: "Clé API invalide" });
    }

    await saveApiKey(apiKey.trim());
    res.json({ message: "Clé API mise à jour avec succès", success: true });
  } catch (error) {
    console.error("Error saving API key:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

// Routes AssemblyAI
app.post("/api/assemblyai/upload", upload.single("file"), async (req, res) => {
  const ASSEMBLYAI_API_KEY = await getApiKey();
  if (!ASSEMBLYAI_API_KEY) {
    return res.status(500).json({ error: "ASSEMBLYAI_API_KEY non configurée" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier fourni" });
  }

  try {
    const uploadResponse = await fetch(ASSEMBLYAI_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: req.file.buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("AssemblyAI upload error:", errorText);
      
      if (uploadResponse.status === 401 || uploadResponse.status === 403) {
        return res.status(uploadResponse.status).json({
          error: "Clé API AssemblyAI invalide ou expirée",
        });
      }

      return res.status(uploadResponse.status).json({
        error: `Erreur upload AssemblyAI: ${uploadResponse.status}`,
      });
    }

    const data = await uploadResponse.json();
    res.json({ upload_url: data.upload_url });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.post("/api/assemblyai/transcripts", async (req, res) => {
  const ASSEMBLYAI_API_KEY = await getApiKey();
  if (!ASSEMBLYAI_API_KEY) {
    return res.status(500).json({ error: "ASSEMBLYAI_API_KEY non configurée" });
  }

  try {
    const { audio_url, language_code, language_codes, speaker_labels, punctuate } = req.body;

    if (!audio_url) {
      return res.status(400).json({ error: "audio_url requis" });
    }

    const payload = {
      audio_url,
    };

    if (language_codes && language_codes.length > 0) {
      payload.language_codes = language_codes;
    } else if (language_code) {
      payload.language_code = language_code;
    }

    if (speaker_labels !== undefined) {
      payload.speaker_labels = speaker_labels;
    }

    if (punctuate !== undefined) {
      payload.punctuate = punctuate;
    }

    const response = await fetch(ASSEMBLYAI_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AssemblyAI transcript error:", errorText);

      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          error: "Clé API AssemblyAI invalide ou expirée",
        });
      }

      return res.status(response.status).json({
        error: `Erreur AssemblyAI: ${response.status}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Transcript creation error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.get("/api/assemblyai/transcripts/:id", async (req, res) => {
  const ASSEMBLYAI_API_KEY = await getApiKey();
  if (!ASSEMBLYAI_API_KEY) {
    return res.status(500).json({ error: "ASSEMBLYAI_API_KEY non configurée" });
  }

  try {
    const { id } = req.params;
    const url = `${ASSEMBLYAI_BASE_URL}/${id}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AssemblyAI get transcript error:", errorText);

      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          error: "Clé API AssemblyAI invalide ou expirée",
        });
      }

      if (response.status === 404) {
        return res.status(404).json({ error: "Transcription introuvable" });
      }

      return res.status(response.status).json({
        error: `Erreur AssemblyAI: ${response.status}`,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Get transcript error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

// Routes Historique
app.get("/api/history", async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM history ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error("Read history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.post("/api/history", async (req, res) => {
  try {
    const { type, text, language, languageCodes, metadata } = req.body;

    if (!type || !text) {
      return res.status(400).json({ error: "type et text requis" });
    }

    const item = {
      id: crypto.randomUUID(),
      type,
      text,
      language,
      language_codes: languageCodes ? JSON.stringify(languageCodes) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    };

    const { rows } = await pool.query(
      'INSERT INTO history (id, type, text, language, language_codes, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [item.id, item.type, item.text, item.language, item.language_codes, item.metadata]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Add history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.delete("/api/history", async (req, res) => {
  try {
    await pool.query('DELETE FROM history');
    res.json({ message: "Historique effacé" });
  } catch (error) {
    console.error("Clear history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.get("/api/history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM history WHERE id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Item introuvable" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get history item error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.delete("/api/history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM history WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: "Item introuvable" });
    }

    res.json({ message: "Item supprimé" });
  } catch (error) {
    console.error("Delete history item error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.get("/api/history/export", async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM history ORDER BY created_at DESC');
    const json = JSON.stringify(rows, null, 2);
    
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transcriptions-${new Date().toISOString().split("T")[0]}.json"`
    );
    res.send(json);
  } catch (error) {
    console.error("Export history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.post("/api/history/import", async (req, res) => {
  const client = await pool.connect();
  try {
    const items = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Format JSON invalide: array attendu" });
    }

    await client.query('BEGIN');
    for (const item of items) {
      await client.query(
        'INSERT INTO history (id, type, text, language, language_codes, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [item.id, item.type, item.text, item.language, JSON.stringify(item.language_codes), JSON.stringify(item.metadata), item.created_at]
      );
    }
    await client.query('COMMIT');
    
    res.json({ message: "Historique importé avec succès" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Import history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  } finally {
    client.release();
  }
});

// Route de test /infos
app.get("/api/infos", async (req, res) => {
  try {
    const { rowCount } = await pool.query('SELECT 1 FROM history');
    const apiKey = await getApiKey();
    
    res.json({
      status: "ok",
      server: "Express",
      port: PORT,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      history: {
        count: rowCount,
      },
      apiKey: {
        configured: !!apiKey,
        masked: apiKey ? `${apiKey.substring(0, 4)}${"*".repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}` : null,
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

app.listen(PORT, async () => {
  await initializeDatabase();
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/api/infos`);
});
