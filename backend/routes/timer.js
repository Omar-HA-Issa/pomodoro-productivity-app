const express = require('express');
const { db } = require('../database');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
router.use(requireAuth);

// GET /api/timer/active - Check for active timer session
router.get('/active', async (req, res) => {
  try {
    const userId = req.user.id;

    const stmt = db.prepare(`
      SELECT * FROM timer_sessions 
      WHERE user_id = ? AND completed = 0
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const activeSession = stmt.get(userId);

    res.json(activeSession || null);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

// POST /api/timer/start - Start new timer session
router.post('/start', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      session_template_id,
      duration_minutes,
      phase = 'focus',
      current_cycle = 0,
      target_cycles = 4
    } = req.body;

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO timer_sessions (
        user_id, session_template_id, duration_minutes, phase, 
        current_cycle, target_cycles, completed, paused, start_time, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `);

    const result = stmt.run(
      userId,
      session_template_id || null,
      duration_minutes,
      phase,
      current_cycle,
      target_cycles,
      now,
      now
    );

    // Get the created timer session
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
    const { timer_id } = req.body;
    const userId = req.user.id;

    const stmt = db.prepare(`
      UPDATE timer_sessions 
      SET paused = 1
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(timer_id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Timer session not found' });
    }

    // Get the updated timer session
    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?');
    const timerSession = getStmt.get(timer_id, userId);

    res.json(timerSession);
  } catch (error) {
    console.error('Error pausing timer:', error);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

// POST /api/timer/resume - Resume paused timer
router.post('/resume', async (req, res) => {
  try {
    const { timer_id } = req.body;
    const userId = req.user.id;

    const stmt = db.prepare(`
      UPDATE timer_sessions 
      SET paused = 0
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(timer_id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Timer session not found' });
    }

    // Get the updated timer session
    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?');
    const timerSession = getStmt.get(timer_id, userId);

    res.json(timerSession);
  } catch (error) {
    console.error('Error resuming timer:', error);
    res.status(500).json({ error: 'Failed to resume timer' });
  }
});

// POST /api/timer/stop - Stop and complete timer
router.post('/stop', async (req, res) => {
  try {
    const { timer_id } = req.body;
    const userId = req.user.id;

    const stmt = db.prepare(`
      UPDATE timer_sessions 
      SET completed = 1, end_time = ?
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(new Date().toISOString(), timer_id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Timer session not found' });
    }

    // Get the updated timer session
    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?');
    const timerSession = getStmt.get(timer_id, userId);

    res.json(timerSession);
  } catch (error) {
    console.error('Error stopping timer:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// POST /api/timer/complete - Mark session complete (for phase transitions)
router.post('/complete', async (req, res) => {
  try {
    const { timer_id } = req.body;
    const userId = req.user.id;

    const stmt = db.prepare(`
      UPDATE timer_sessions 
      SET completed = 1, end_time = ?
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(new Date().toISOString(), timer_id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Timer session not found' });
    }

    // Get the updated timer session
    const getStmt = db.prepare('SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?');
    const timerSession = getStmt.get(timer_id, userId);

    res.json(timerSession);
  } catch (error) {
    console.error('Error completing timer session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

module.exports = router;