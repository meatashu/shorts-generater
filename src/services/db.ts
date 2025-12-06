import initSqlJs, { Database, QueryExecResult } from 'sql.js';
import { get, set } from 'idb-keyval';

let dbInstance: Database | null = null;
const DB_KEY = 'shorts_generator_sqlite_db';

export interface Interaction {
    id?: number;
    prompt: string;
    response: string;
    model: string;
    timestamp: string;
}

export const initDB = async (): Promise<Database> => {
    if (dbInstance) return dbInstance;

    const SQL = await initSqlJs({
        locateFile: (file) => `/${file}`,
    });

    const savedData = await get(DB_KEY);

    if (savedData) {
        dbInstance = new SQL.Database(new Uint8Array(savedData));
    } else {
        dbInstance = new SQL.Database();
        // Create table
        dbInstance.run(`
      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt TEXT,
        response TEXT,
        model TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }

    return dbInstance;
};

export const saveInteraction = async (prompt: string, response: string, model: string) => {
    const db = await initDB();
    const timestamp = new Date().toISOString();

    // Insert
    db.run(`INSERT INTO interactions (prompt, response, model, timestamp) VALUES (?, ?, ?, ?)`, [prompt, response, model, timestamp]);

    // Enforce limit of 100
    // Simplest way: Check count, if > 100, delete oldest
    const result = db.exec("SELECT COUNT(*) FROM interactions");
    const count = result[0].values[0][0] as number;

    if (count > 100) {
        db.run("DELETE FROM interactions WHERE id IN (SELECT id FROM interactions ORDER BY id ASC LIMIT ?)", [count - 100]);
    }

    await persistDB();
};

export const getCachedInteraction = async (prompt: string): Promise<Interaction | null> => {
    const db = await initDB();
    // exact match for now, could be fuzzy later?
    const stmt = db.prepare("SELECT * FROM interactions WHERE prompt = ? ORDER BY id DESC LIMIT 1");
    stmt.bind([prompt]);

    if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result as unknown as Interaction;
    }
    stmt.free();
    return null;
};

export const getAllInteractions = async (): Promise<Interaction[]> => {
    const db = await initDB();
    const res = db.exec("SELECT * FROM interactions ORDER BY id DESC");
    if (res.length === 0) return [];

    const columns = res[0].columns;
    const values = res[0].values;

    return values.map(row => {
        const obj: any = {};
        columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj as Interaction;
    });
};

const persistDB = async () => {
    if (!dbInstance) return;
    const data = dbInstance.export();
    await set(DB_KEY, data);
};
