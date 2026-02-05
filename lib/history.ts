
import { getDB } from './db';

export interface HistoryItem {
  id: string;
  status: string;
  url: string;
  transcript: string;
  created_at: string;
}

export async function readHistory(): Promise<HistoryItem[]> {
  const db = getDB();
  const { rows } = await db.query('SELECT * FROM history ORDER BY created_at DESC');
  return rows;
}

export async function getHistoryItem(id: string): Promise<HistoryItem | null> {
  const db = getDB();
  const { rows } = await db.query('SELECT * FROM history WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function addHistoryItem(item: Omit<HistoryItem, 'created_at'>): Promise<void> {
  const db = getDB();
  await db.query(
    'INSERT INTO history (id, status, url, transcript) VALUES ($1, $2, $3, $4)',
    [item.id, item.status, item.url, item.transcript]
  );
}

export async function deleteHistoryItem(id: string): Promise<boolean> {
  const db = getDB();
  const result = await db.query('DELETE FROM history WHERE id = $1', [id]);
  return !!result.rowCount;
}

export async function clearHistory(): Promise<void> {
  const db = getDB();
  await db.query('DELETE FROM history');
}

export async function importHistory(items: HistoryItem[]): Promise<void> {
    const db = getDB();
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        for (const item of items) {
            await client.query('INSERT INTO history (id, status, url, transcript, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING', [item.id, item.status, item.url, item.transcript, item.created_at]);
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}
