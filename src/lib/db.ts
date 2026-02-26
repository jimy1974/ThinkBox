import Database from 'better-sqlite3';
import path from 'path';
import { DBSession, DBNode, DBDeepDive } from '@/types';

const DB_PATH = path.join(process.cwd(), 'thinkbox.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'anonymous',
      original_prompt TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      agent_type TEXT NOT NULL CHECK(agent_type IN ('root','creator','skeptic','lateral','summary')),
      content TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      grade INTEGER CHECK(grade >= 1 AND grade <= 5),
      status TEXT NOT NULL DEFAULT 'complete' CHECK(status IN ('pending','generating','complete','ignored')),
      x_pos REAL NOT NULL DEFAULT 0,
      y_pos REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deep_dives (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      full_markdown_content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_deep_dives_node ON deep_dives(node_id);
  `);
}

// Session helpers

export function createSession(id: string, prompt: string, userId = 'anonymous'): DBSession {
  const db = getDb();
  db.prepare(`INSERT INTO sessions (id, user_id, original_prompt, phase) VALUES (?, ?, ?, 'idle')`).run(id, userId, prompt);
  return getSession(id)!;
}

export function getSession(id: string): DBSession | null {
  return (getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as DBSession) ?? null;
}

export function updateSessionPhase(id: string, phase: string) {
  getDb().prepare('UPDATE sessions SET phase = ? WHERE id = ?').run(phase, id);
}

export interface DBSessionWithCount extends DBSession {
  node_count: number;
}

export function getAllSessions(userId: string, limit = 50): DBSessionWithCount[] {
  return getDb().prepare(`
    SELECT s.*, COUNT(n.id) as node_count
    FROM sessions s
    LEFT JOIN nodes n ON n.session_id = s.id AND n.agent_type != 'root'
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT ?
  `).all(userId, limit) as DBSessionWithCount[];
}

export function deleteSession(id: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

// Node helpers

export function createNode(node: Omit<DBNode, 'created_at'>): DBNode {
  const db = getDb();
  db.prepare(`
    INSERT INTO nodes (id, session_id, parent_id, agent_type, content, metadata, grade, status, x_pos, y_pos)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    node.id, node.session_id, node.parent_id, node.agent_type,
    node.content, node.metadata, node.grade, node.status,
    node.x_pos, node.y_pos
  );
  return getNode(node.id)!;
}

export function getNode(id: string): DBNode | null {
  return (getDb().prepare('SELECT * FROM nodes WHERE id = ?').get(id) as DBNode) ?? null;
}

export function getSessionNodes(sessionId: string): DBNode[] {
  return getDb().prepare('SELECT * FROM nodes WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as DBNode[];
}

export function updateNode(id: string, updates: Partial<Pick<DBNode, 'content' | 'metadata' | 'grade' | 'status' | 'x_pos' | 'y_pos'>>) {
  const db = getDb();
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(updates), id];
  db.prepare(`UPDATE nodes SET ${sets} WHERE id = ?`).run(...vals);
}

export function getChildNodes(nodeId: string): DBNode[] {
  return getDb().prepare('SELECT * FROM nodes WHERE parent_id = ?').all(nodeId) as DBNode[];
}

export function countChildNodes(nodeId: string): number {
  const result = getDb().prepare('SELECT COUNT(*) as cnt FROM nodes WHERE parent_id = ?').get(nodeId) as { cnt: number };
  return result.cnt;
}

// Deep dive helpers

export function createDeepDive(id: string, nodeId: string, content: string): DBDeepDive {
  const db = getDb();
  db.prepare('INSERT INTO deep_dives (id, node_id, full_markdown_content) VALUES (?, ?, ?)').run(id, nodeId, content);
  return getDeepDive(nodeId)!;
}

export function getDeepDive(nodeId: string): DBDeepDive | null {
  return (getDb().prepare('SELECT * FROM deep_dives WHERE node_id = ? ORDER BY created_at DESC LIMIT 1').get(nodeId) as DBDeepDive) ?? null;
}
