const express = require('express');
const { db } = require('../database');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

// Helpers
const nowIso = () => new Date().toISOString();
const VALID_PHASES = new Set(['focus', 'short_break', 'long_break']);

function getActiveSession(userId) {
  const stmt = db.prepare(`
    SELECT * FROM timer_sessions
    WHERE user_id = ? AND completed = 0
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return stmt.get(userId);
}

// GET /api/timer/active - Check for active timer session
router.get('/active', async (req, res) => {
  try {
    const userId = req.user.id;
    const row = getActiveSession(userId);
    res.json(row || null);
  } catch (error) {
    console.error('Error fetching active timer:', error);
    res.status(500).json({ error: 'Failed to fetch active timer' });
  }
});

// POST /api/timer/start - Start a (phase of a) timer session
// Body: { session_template_id, duration_minutes, phase, current_cycle, target_cycles, session_group_id }
router.post('/start', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      session_template_id = null,
      duration_minutes,
      phase = 'focus',
      current_cycle = 0,
      target_cycles = 4,
      session_group_id = null,
    } = req.body || {};

    if (!Number.isFinite(Number(duration_minutes))) {
      return res.status(400).json({ error: 'duration_minutes is required (number)' });
    }
    if (!VALID_PHASES.has(phase)) {
      return res.status(400).json({ error: `Invalid phase. Use one of: ${[...VALID_PHASES].join(', ')}` });
    }

    const start = nowIso();

    const insert = db.prepare(`
      INSERT INTO timer_sessions (
        user_id, session_template_id, duration_minutes, phase,
        current_cycle, target_cycles, completed, paused,
        start_time, created_at, session_group_id
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
    `);

    const result = insert.run(
      userId,
      session_template_id,
      Number(duration_minutes),
      phase,
      Number(current_cycle),
      Number(target_cycles),
      start,
      start,
      session_group_id
    );

    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ?');
    const timerSession = getStmt.get(result.lastInsertRowid);
    res.status(201).json(timerSession);
  } catch (error) {
    console.error('Error starting timer:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// POST /api/timer/pause - Pause current timer
router.post('/pause', async (req, res) => {
  try {
    const userId = req.user.id;
    const active = getActiveSession(userId);
    if (!active) return res.status(404).json({ error: 'No active timer to pause' });

    const upd = db.prepare('UPDATE timer_sessions SET paused = 1 WHERE id = ? AND user_id = ?');
    upd.run(active.id, userId);

    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ?');
    res.json(getStmt.get(active.id));
  } catch (error) {
    console.error('Error pausing timer:', error);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

// POST /api/timer/resume - Resume paused timer
router.post('/resume', async (req, res) => {
  try {
    const userId = req.user.id;
    const active = getActiveSession(userId);
    if (!active) return res.status(404).json({ error: 'No active timer to resume' });

    const upd = db.prepare('UPDATE timer_sessions SET paused = 0 WHERE id = ? AND user_id = ?');
    upd.run(active.id, userId);

    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ?');
    res.json(getStmt.get(active.id));
  } catch (error) {
    console.error('Error resuming timer:', error);
    res.status(500).json({ error: 'Failed to resume timer' });
  }
});

// POST /api/timer/stop - Manually stop and mark as completed
router.post('/stop', async (req, res) => {
  try {
    const userId = req.user.id;
    const active = getActiveSession(userId);
    if (!active) return res.status(404).json({ error: 'No active timer to stop' });

    const ts = nowIso();
    const upd = db.prepare(`
      UPDATE timer_sessions
      SET completed = 1, paused = 0, end_time = ?
      WHERE id = ? AND user_id = ?
    `);
    upd.run(ts, active.id, userId);

    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ?');
    res.json(getStmt.get(active.id));
  } catch (error) {
    console.error('Error stopping timer:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// POST /api/timer/complete - Mark a specific timer row as completed
// Body: { timer_id }
router.post('/complete', async (req, res) => {
  try {
    const userId = req.user.id;
    const { timer_id } = req.body || {};
    if (!timer_id) return res.status(400).json({ error: 'timer_id is required' });

    const check = db.prepare('SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?');
    const row = check.get(timer_id, userId);
    if (!row) return res.status(404).json({ error: 'Timer session not found' });

    const ts = nowIso();
    const upd = db.prepare('UPDATE timer_sessions SET completed = 1, paused = 0, end_time = ? WHERE id = ? AND user_id = ?');
    upd.run(ts, timer_id, userId);

    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?');
    const updated = getStmt.get(timer_id, userId);
    res.json(updated);
  } catch (error) {
    console.error('Error completing timer session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// PATCH /api/timer/:id/notes - add/update notes (also used by Insights)
router.patch('/:id/notes', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { notes = null } = req.body || {};

    const check = db.prepare('SELECT id FROM timer_sessions WHERE id = ? AND user_id = ?');
    const found = check.get(id, userId);
    if (!found) return res.status(404).json({ error: 'Timer session not found' });

    const upd = db.prepare('UPDATE timer_sessions SET notes = ? WHERE id = ? AND user_id = ?');
    upd.run(notes, id, userId);

    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ?');
    res.json(getStmt.get(id));
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

// (optional) GET /api/timer/history - last N sessions (raw rows)
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const stmt = db.prepare(`
      SELECT * FROM timer_sessions
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `);
    res.json(stmt.all(userId, limit));
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
