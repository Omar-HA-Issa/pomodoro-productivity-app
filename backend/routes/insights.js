const express = require('express');
const { db } = require('../database');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

// GET /api/insights/completed-sessions
// Returns one row per full multi-cycle run (grouped via session_group_id),
router.get('/completed-sessions', async (req, res) => {
  try {
    const userId = req.user.id;

    const groupedStmt = db.prepare(`
      WITH grouped AS (
        SELECT
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
        WHERE ts.user_id = ?
          AND ts.completed = 1
          AND ts.session_group_id IS NOT NULL
        GROUP BY ts.session_group_id
        HAVING focus_blocks >= target_cycles
      ),
      legacy AS (
        -- Fallback for old data that has no session_group_id: only pick completed focus rows
        SELECT
          NULL AS session_group_id,
          ts.id AS rep_id,
          COALESCE(ts.end_time, ts.start_time, ts.created_at) AS rep_date,
          ts.duration_minutes AS total_focus_min,
          1 AS focus_blocks,
          ts.target_cycles AS target_cycles,
          ts.analyzed_at AS analyzed_at,
          ts.sentiment_label AS sentiment_label,
          ts.sentiment_score AS sentiment_score,
          ts.session_template_id AS session_template_id
        FROM timer_sessions ts
        WHERE ts.user_id = ?
          AND ts.completed = 1
          AND ts.session_group_id IS NULL
          AND ts.phase = 'focus'
      )
      SELECT * FROM grouped
      UNION ALL
      SELECT * FROM legacy
      ORDER BY rep_date DESC
      LIMIT 300;
    `);

    const rows = groupedStmt.all(userId, userId);

    // Map to response with template names
    const sessions = rows.map(r => {
      const nameStmt = db.prepare('SELECT name FROM sessions WHERE id = ?');
      const nameRow = r.session_template_id ? nameStmt.get(r.session_template_id) : null;
      const title = nameRow?.name || 'Focus Session';

      return {
        id: `timer_${r.rep_id}`,
        title,
        date: r.rep_date,
        duration: r.total_focus_min || 0,
        notes: '',
        sentiment: r.sentiment_label ? { label: String(r.sentiment_label), score: Number(r.sentiment_score) } : null,
        analyzedAt: r.analyzed_at || null,
      };
    });

    res.json({ sessions });
  } catch (err) {
    console.error('Error fetching completed sessions (insights):', err);
    res.status(500).json({ error: 'Failed to fetch completed sessions' });
  }
});

// POST /api/insights/analyze
// Body: { id: 'timer_123' | 123, sentiment_label, sentiment_score }
router.post('/analyze', async (req, res) => {
  try {
    const userId = req.user.id;
    let { id, sentiment_label = null, sentiment_score = null } = req.body || {};

    if (!id) return res.status(400).json({ error: 'id is required' });

    // Support the synthetic timer_ prefix
    if (typeof id === 'string' && id.startsWith('timer_')) {
      id = Number(id.replace('timer_', ''));
    }

    const check = db.prepare('SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?');
    const row = check.get(id, userId);
    if (!row) return res.status(404).json({ error: 'Timer session not found' });

    const ts = new Date().toISOString();
    const upd = db.prepare(`
      UPDATE timer_sessions
      SET analyzed_at = ?,
          sentiment_label = ?,
          sentiment_score = ?
      WHERE id = ? AND user_id = ?
    `);
    upd.run(ts, sentiment_label, sentiment_score, id, userId);

    // Return the aggregated run item again
    // If this row belongs to a group, respond with the grouped representative.
    let repRow;
    if (row.session_group_id) {
      const repStmt = db.prepare(`
        SELECT MIN(id) AS rep_id
        FROM timer_sessions
        WHERE user_id = ? AND session_group_id = ?
      `);
      repRow = repStmt.get(userId, row.session_group_id);
    } else {
      repRow = { rep_id: row.id };
    }

    res.json({ id: `timer_${repRow.rep_id}`, analyzedAt: ts, sentiment: { label: sentiment_label, score: sentiment_score } });
  } catch (err) {
    console.error('Error analyzing session:', err);
    res.status(500).json({ error: 'Failed to analyze session' });
  }
});

module.exports = router;
