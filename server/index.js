const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware CORS - configuré pour la production
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3005",
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Permettre les requêtes sans origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || !process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Configuration multer pour l'upload
const upload = multer({ storage: multer.memoryStorage() });

const ASSEMBLYAI_UPLOAD_URL = "https://api.assemblyai.com/v2/upload";
const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2/transcript";

// Fichier de configuration pour la clé API
const API_KEY_FILE = path.join(process.cwd(), "config", "api-key.json");
const ENV_FILE = path.join(process.cwd(), ".env.local");

// Fonction pour lire la clé API
async function getApiKey() {
  try {
    // Essayer de lire depuis le fichier de config
    try {
      const configContent = await fs.readFile(API_KEY_FILE, "utf-8");
      const config = JSON.parse(configContent);
      if (config.ASSEMBLYAI_API_KEY) {
        return config.ASSEMBLYAI_API_KEY;
      }
    } catch (e) {
      // Fichier n'existe pas, continuer
    }

    // Essayer de lire depuis .env.local
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

    // Fallback sur process.env
    return process.env.ASSEMBLYAI_API_KEY || null;
  } catch (error) {
    console.error("Error reading API key:", error);
    return process.env.ASSEMBLYAI_API_KEY || null;
  }
}

// Fonction pour sauvegarder la clé API
async function saveApiKey(apiKey) {
  try {
    // Créer le dossier config s'il n'existe pas
    const configDir = path.dirname(API_KEY_FILE);
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }

    // Sauvegarder dans le fichier de config
    await fs.writeFile(
      API_KEY_FILE,
      JSON.stringify({ ASSEMBLYAI_API_KEY: apiKey }, null, 2),
      "utf-8"
    );

    // Mettre à jour .env.local aussi
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

      // Ajouter NEXT_PUBLIC_API_URL s'il n'existe pas
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
    // Masquer la clé (afficher seulement les 4 premiers et 4 derniers caractères)
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

// Utilitaires pour l'historique
const HISTORY_FILE = path.join(process.cwd(), "data", "transcriptions.json");
const MAX_ITEMS = 5;

let fileLock = false;
const lockQueue = [];

function acquireLock() {
  return new Promise((resolve) => {
    if (!fileLock) {
      fileLock = true;
      resolve(() => {
        fileLock = false;
        if (lockQueue.length > 0) {
          const next = lockQueue.shift();
          if (next) next();
        }
      });
    } else {
      lockQueue.push(() => {
        fileLock = true;
        resolve(() => {
          fileLock = false;
          if (lockQueue.length > 0) {
            const next = lockQueue.shift();
            if (next) next();
          }
        });
      });
    }
  });
}

async function ensureDataDir() {
  const dataDir = path.dirname(HISTORY_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function readHistory() {
  const release = await acquireLock();
  try {
    await ensureDataDir();
    try {
      const content = await fs.readFile(HISTORY_FILE, "utf-8");
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.code === "ENOENT") {
        // Créer le fichier avec un tableau vide s'il n'existe pas
        console.log("History file does not exist, creating it...");
        await fs.writeFile(HISTORY_FILE, JSON.stringify([], null, 2), "utf-8");
        return [];
      }
      // Si c'est une erreur de parsing JSON, créer un nouveau fichier
      if (error instanceof SyntaxError) {
        console.log("History file has invalid JSON, recreating it...");
        await fs.writeFile(HISTORY_FILE, JSON.stringify([], null, 2), "utf-8");
        return [];
      }
      throw error;
    }
  } finally {
    release();
  }
}

async function writeHistory(items) {
  const release = await acquireLock();
  try {
    console.log("writeHistory - Writing", items.length, "items to", HISTORY_FILE);
    await ensureDataDir();
    
    // Vérifier que le dossier existe
    const dataDir = path.dirname(HISTORY_FILE);
    try {
      await fs.access(dataDir);
      console.log("writeHistory - Data directory exists:", dataDir);
    } catch {
      console.log("writeHistory - Creating data directory:", dataDir);
      await fs.mkdir(dataDir, { recursive: true });
    }
    
    const content = JSON.stringify(items, null, 2);
    console.log("writeHistory - Content length:", content.length, "bytes");
    
    await fs.writeFile(HISTORY_FILE, content, "utf-8");
    
    // Vérifier que le fichier existe maintenant
    try {
      const stats = await fs.stat(HISTORY_FILE);
      console.log("writeHistory - File written successfully, size:", stats.size, "bytes");
    } catch (err) {
      console.error("writeHistory - ERROR: File does not exist after write!", err);
      throw new Error("File was not created after write operation");
    }
  } catch (error) {
    console.error("writeHistory - Error:", error);
    console.error("writeHistory - Error details:", {
      message: error.message,
      code: error.code,
      path: error.path,
    });
    throw error;
  } finally {
    release();
  }
}

async function addHistoryItem(item) {
  const release = await acquireLock();
  try {
    console.log("addHistoryItem - Starting, item:", { id: item.id, type: item.type, textLength: item.text?.length });
    const history = await readHistory();
    console.log("addHistoryItem - Current history length:", history.length);
    
    // Ajouter le nouvel item au début
    const updated = [item, ...history]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_ITEMS);
    
    console.log("addHistoryItem - Updated history length:", updated.length);
    console.log("addHistoryItem - About to write to:", HISTORY_FILE);
    
    await writeHistory(updated);
    
    // Vérifier que le fichier a bien été écrit
    const verify = await readHistory();
    console.log("addHistoryItem - Verification: history now has", verify.length, "items");
    
    if (verify.length === 0 && updated.length > 0) {
      console.error("addHistoryItem - WARNING: File was written but verification shows empty array!");
    }
    
    console.log("addHistoryItem - History written successfully");
  } catch (error) {
    console.error("addHistoryItem - Error:", error);
    console.error("addHistoryItem - Error stack:", error.stack);
    throw error;
  } finally {
    release();
  }
}

async function deleteHistoryItem(id) {
  const release = await acquireLock();
  try {
    const history = await readHistory();
    const filtered = history.filter((item) => item.id !== id);
    if (filtered.length === history.length) {
      return false;
    }
    await writeHistory(filtered);
    return true;
  } finally {
    release();
  }
}

async function clearHistory() {
  const release = await acquireLock();
  try {
    await writeHistory([]);
  } finally {
    release();
  }
}

async function importHistory(items) {
  const release = await acquireLock();
  try {
    const existing = await readHistory();
    const merged = [...items, ...existing]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_ITEMS);
    await writeHistory(merged);
  } finally {
    release();
  }
}

// Routes Historique
app.get("/api/history", async (req, res) => {
  try {
    const history = await readHistory();
    res.json(history);
  } catch (error) {
    console.error("Read history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.post("/api/history", async (req, res) => {
  try {
    const { type, text, language, languageCodes, metadata } = req.body;

    console.log("POST /api/history - Received:", { type, textLength: text?.length, language, languageCodes, metadata });

    if (!type || !text) {
      console.error("Missing required fields:", { type, hasText: !!text });
      return res.status(400).json({ error: "type et text requis" });
    }

    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
      type,
      text,
      language,
      languageCodes,
      metadata,
      createdAt: new Date().toISOString(),
    };

    console.log("Adding item to history:", { id: item.id, type: item.type, textLength: item.text.length });
    await addHistoryItem(item);
    console.log("Item added successfully");
    res.status(201).json(item);
  } catch (error) {
    console.error("Add history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.delete("/api/history", async (req, res) => {
  try {
    await clearHistory();
    res.json({ message: "Historique effacé" });
  } catch (error) {
    console.error("Clear history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.get("/api/history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const history = await readHistory();
    const item = history.find((item) => item.id === id);

    if (!item) {
      return res.status(404).json({ error: "Item introuvable" });
    }

    res.json(item);
  } catch (error) {
    console.error("Get history item error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.delete("/api/history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteHistoryItem(id);

    if (!deleted) {
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
    const history = await readHistory();
    const json = JSON.stringify(history, null, 2);
    
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
  try {
    const items = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Format JSON invalide: array attendu" });
    }

    await importHistory(items);
    res.json({ message: "Historique importé avec succès" });
  } catch (error) {
    console.error("Import history error:", error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

app.post("/api/translate", (req, res) => {
  res.status(501).json({
    error: "Fonctionnalité de traduction non configurée",
    message: "Cette fonctionnalité nécessite une configuration supplémentaire.",
  });
});

// Route de test /infos
app.get("/api/infos", async (req, res) => {
  try {
    const history = await readHistory();
    const apiKey = await getApiKey();
    
    res.json({
      status: "ok",
      server: "Express",
      port: PORT,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      history: {
        count: history.length,
        maxItems: MAX_ITEMS,
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

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/api/infos`);
});

