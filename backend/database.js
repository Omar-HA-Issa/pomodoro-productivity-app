// backend/database.js
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "pomodoro.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  target_pomodoros INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  title TEXT,
  start_datetime TEXT NOT NULL,
  duration_min INTEGER DEFAULT 25,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
`);

module.exports = db;
