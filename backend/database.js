const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// SQLite Database
const dbPath = path.join(__dirname, 'pomodoro.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    focus_duration INTEGER NOT NULL,
    break_duration INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS timer_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_template_id INTEGER,
    duration_minutes INTEGER NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('focus', 'short_break', 'long_break')),
    current_cycle INTEGER DEFAULT 0,
    target_cycles INTEGER DEFAULT 4,
    completed BOOLEAN DEFAULT FALSE,
    paused BOOLEAN DEFAULT FALSE,
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_template_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS scheduled_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id INTEGER,
    title TEXT,
    start_datetime DATETIME NOT NULL,
    duration_min INTEGER DEFAULT 25,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_timer_sessions_user_id ON timer_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_timer_sessions_completed ON timer_sessions(completed);
  CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_user_id ON scheduled_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_datetime ON scheduled_sessions(start_datetime);
`);

try {
  db.exec(`ALTER TABLE scheduled_sessions ADD COLUMN completed BOOLEAN DEFAULT FALSE;`);
} catch (e) {
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials for auth');
  throw new Error('Missing Supabase credentials. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for auth');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = {
  db,           // SQLite database for app data
  supabase      // Supabase client for auth
};