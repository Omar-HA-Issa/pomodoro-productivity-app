// backend/routes/insights.js
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

/**
 * GET /api/insights/completed-sessions
 * -> Only from timer_sessions (Focus), not schedule
 */
router.get('/completed-sessions', (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const stmt = db.prepare(`
      SELECT
        'timer_' || id AS id,
        'Focus Session' AS title,
        COALESCE(end_time, start_time) AS date,
        duration_minutes AS duration,
        notes,
        sentiment_label,
        sentiment_score,
        analyzed_at
      FROM timer_sessions
      WHERE user_id = ? AND completed = 1
    `);

    const rows = stmt.all(userId);

    const sessions = rows
      .map((r) => ({
        id: String(r.id),                                // "timer_123"
        title: r.title || 'Focus Session',
        date: r.date,
        duration: r.duration ?? 25,
        notes: r.notes ?? '',
        sentiment: r.sentiment_label
          ? { label: String(r.sentiment_label), score: Number(r.sentiment_score) }
          : null,
        analyzedAt: r.analyzed_at || null,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ sessions });
  } catch (err) {
    console.error('Error fetching completed sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * POST /api/insights/analyze
 * Body: { id | sessionId, notes? }
 * -> Only timer_sessions accepted
 */
router.post('/analyze', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rawId = req.body?.id || req.body?.sessionId;
    const notesFromBody = req.body?.notes;

    if (!rawId) return res.status(400).json({ error: 'Missing session id' });

    // Accept "timer_123" or plain 123; normalize to numeric ID
    let actualId = null;
    if (typeof rawId === 'string' && rawId.startsWith('timer_')) {
      const n = Number(rawId.split('_')[1]);
      if (Number.isInteger(n)) actualId = n;
    } else if (Number.isInteger(Number(rawId))) {
      actualId = Number(rawId);
    }
    if (actualId == null) {
      return res.status(400).json({ error: 'Invalid session id format (expected timer_<id>)' });
    }

    // Fetch existing row
    const current = db
      .prepare(`SELECT id, user_id, notes FROM timer_sessions WHERE id = ? AND user_id = ?`)
      .get(actualId, userId);
    if (!current) return res.status(404).json({ error: 'Session not found' });

    const notes = typeof notesFromBody === 'string' ? notesFromBody : (current.notes || '');

    // If new notes provided, save them before analysis
    if (typeof notesFromBody === 'string') {
      db.prepare(`UPDATE timer_sessions SET notes = ? WHERE id = ? AND user_id = ?`)
        .run(notes, actualId, userId);
    }

    // Hugging Face Inference API (free tier-ready)
    const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
    if (!HF_API_KEY) {
      console.error('Hugging Face API key not configured');
      return res.status(500).json({ error: 'AI service not configured' });
    }

    const HF_API_URL =
      'https://api-inference.huggingface.co/models/distilbert/distilbert-base-uncased-finetuned-sst-2-english';

    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: notes || 'No notes',
        options: { wait_for_model: true },
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('HF error:', response.status, responseText);
      throw new Error(`Hugging Face API error: ${response.status} - ${responseText}`);
    }

    // Normalize output: [{label, score}] or [[{label, score}, ...]]
    let parsed = JSON.parse(responseText);
    if (Array.isArray(parsed) && Array.isArray(parsed[0])) parsed = parsed[0];

    const top = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
    if (!top || !top.label || typeof top.score !== 'number') {
      throw new Error('Unexpected Hugging Face response format');
    }

    let sentimentLabel = String(top.label).toUpperCase(); // POSITIVE/NEGATIVE
    const sentimentScore = Number(top.score);
    if (sentimentScore < 0.6) sentimentLabel = 'NEUTRAL';

    // Persist analysis to timer_sessions only
    const upd = db.prepare(`
      UPDATE timer_sessions
      SET notes = ?, sentiment_label = ?, sentiment_score = ?, analyzed_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(notes, sentimentLabel, sentimentScore, actualId, userId);

    if (upd.changes === 0) {
      return res.status(404).json({ error: 'Session not found or unauthorized' });
    }

    return res.json({
      success: true,
      sentiment: { label: sentimentLabel, score: sentimentScore },
    });
  } catch (err) {
    console.error('Error analyzing sentiment:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

/**
 * GET /api/insights/stats
 * -> Only timer_sessions
 */
router.get('/stats', (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const total = db.prepare(`SELECT COUNT(*) AS c FROM timer_sessions WHERE user_id = ?`).get(userId).c;
    const completed = db.prepare(`SELECT COUNT(*) AS c FROM timer_sessions WHERE user_id = ? AND completed = 1`).get(userId).c;
    const analyzed = db.prepare(`SELECT COUNT(*) AS c FROM timer_sessions WHERE user_id = ? AND sentiment_label IS NOT NULL`).get(userId).c;
    const positive = db.prepare(`SELECT COUNT(*) AS c FROM timer_sessions WHERE user_id = ? AND sentiment_label = 'POSITIVE'`).get(userId).c;
    const neutral = db.prepare(`SELECT COUNT(*) AS c FROM timer_sessions WHERE user_id = ? AND sentiment_label = 'NEUTRAL'`).get(userId).c;
    const negative = db.prepare(`SELECT COUNT(*) AS c FROM timer_sessions WHERE user_id = ? AND sentiment_label = 'NEGATIVE'`).get(userId).c;

    res.json({ total, completed, analyzed, positive, neutral, negative });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
