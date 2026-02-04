import { promises as fs } from "fs";
import path from "path";

const HISTORY_FILE = path.join(process.cwd(), "data", "transcriptions.json");
const MAX_ITEMS = 5;

export interface HistoryItem {
  id: string;
  type: "transcription" | "text";
  text: string;
  language?: string;
  languageCodes?: string[];
  createdAt: string;
  metadata?: {
    filename?: string;
    speakerLabels?: boolean;
    punctuate?: boolean;
  };
}

let fileLock = false;
const lockQueue: Array<() => void> = [];

async function acquireLock(): Promise<() => void> {
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

async function ensureDataDir(): Promise<void> {
  const dataDir = path.dirname(HISTORY_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

export async function readHistory(): Promise<HistoryItem[]> {
  const release = await acquireLock();
  try {
    await ensureDataDir();
    try {
      const content = await fs.readFile(HISTORY_FILE, "utf-8");
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  } finally {
    release();
  }
}

export async function writeHistory(items: HistoryItem[]): Promise<void> {
  const release = await acquireLock();
  try {
    await ensureDataDir();
    await fs.writeFile(HISTORY_FILE, JSON.stringify(items, null, 2), "utf-8");
  } finally {
    release();
  }
}

export async function addHistoryItem(item: HistoryItem): Promise<void> {
  const release = await acquireLock();
  try {
    const history = await readHistory();
    const updated = [item, ...history]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_ITEMS);
    await writeHistory(updated);
  } finally {
    release();
  }
}

export async function deleteHistoryItem(id: string): Promise<boolean> {
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

export async function clearHistory(): Promise<void> {
  const release = await acquireLock();
  try {
    await writeHistory([]);
  } finally {
    release();
  }
}

export async function importHistory(items: HistoryItem[]): Promise<void> {
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

