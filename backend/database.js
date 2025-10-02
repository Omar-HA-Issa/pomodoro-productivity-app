const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// SQLite Database
const dbPath = path.join(__dirname, 'pomodoro.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Base schema (tables + base indexes)
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

// Migrations

// scheduled_sessions.completed
try { db.exec(`ALTER TABLE scheduled_sessions ADD COLUMN completed BOOLEAN DEFAULT FALSE;`); } catch (_) {}

// timer_sessions sentiment fields
try { db.exec(`ALTER TABLE timer_sessions ADD COLUMN notes TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE timer_sessions ADD COLUMN sentiment_label TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE timer_sessions ADD COLUMN sentiment_score REAL;`); } catch (_) {}
try { db.exec(`ALTER TABLE timer_sessions ADD COLUMN analyzed_at DATETIME;`); } catch (_) {}

// scheduled_sessions sentiment fields
try { db.exec(`ALTER TABLE scheduled_sessions ADD COLUMN notes TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE scheduled_sessions ADD COLUMN sentiment_label TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE scheduled_sessions ADD COLUMN sentiment_score REAL;`); } catch (_) {}
try { db.exec(`ALTER TABLE scheduled_sessions ADD COLUMN analyzed_at DATETIME;`); } catch (_) {}

// session_group_id (for grouping all cycles within a single run)
try { db.exec(`ALTER TABLE timer_sessions ADD COLUMN session_group_id TEXT;`); } catch (_) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_timer_sessions_group ON timer_sessions(session_group_id);`); } catch (_) {}

// Helps ORDER BY date scans from the view
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_timer_sessions_endtime ON timer_sessions(end_time);`); } catch (_) {}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials for auth');
  throw new Error('Missing Supabase credentials. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for auth');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Insights read model (SQL VIEW)
try {
  db.exec(`
    DROP VIEW IF EXISTS insights_session_runs;
    CREATE VIEW insights_session_runs AS
    WITH grouped AS (
      SELECT
        ts.user_id,
        ts.session_group_id,
        MIN(ts.id) AS rep_id,
        MAX(COALESCE(ts.end_time, ts.start_time, ts.created_at)) AS rep_date,
        SUM(CASE WHEN ts.phase = 'focus' THEN ts.duration_minutes ELSE 0 END) AS total_focus_min,
        SUM(CASE WHEN ts.phase = 'focus' THEN 1 ELSE 0 END) AS focus_blocks,
        MAX(ts.target_cycles) AS target_cycles,
        MAX(ts.analyzed_at) AS analyzed_at,
        (SELECT t2.sentiment_label
           FROM timer_sessions t2
          WHERE t2.user_id = ts.user_id
            AND t2.session_group_id = ts.session_group_id
            AND t2.sentiment_label IS NOT NULL
          ORDER BY t2.analyzed_at DESC
          LIMIT 1) AS sentiment_label,
        (SELECT t2.sentiment_score
           FROM timer_sessions t2
          WHERE t2.user_id = ts.user_id
            AND t2.session_group_id = ts.session_group_id
            AND t2.sentiment_label IS NOT NULL
          ORDER BY t2.analyzed_at DESC
          LIMIT 1) AS sentiment_score,
        MAX(ts.session_template_id) AS session_template_id
      FROM timer_sessions ts
      WHERE ts.completed = 1
        AND ts.session_group_id IS NOT NULL
      GROUP BY ts.user_id, ts.session_group_id
      HAVING focus_blocks >= target_cycles
    )
    SELECT
      g.user_id,
      'timer_' || g.rep_id AS id,
      COALESCE(s.name, 'Focus Session') AS title,
      g.rep_date AS date,
      g.total_focus_min AS duration,
      g.sentiment_label,
      g.sentiment_score,
      g.analyzed_at
    FROM grouped g
    LEFT JOIN sessions s ON s.id = g.session_template_id;
  `);
} catch (_) {
  // ignore view recreation errors
}

try { db.exec(`DELETE FROM timer_sessions WHERE session_group_id IS NULL;`); } catch (_) {}

module.exports = {
  db,       // SQLite database for app data
  supabase, // Supabase client for auth
};
