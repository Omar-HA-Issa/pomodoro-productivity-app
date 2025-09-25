const router = require("express").Router();
const { db } = require("../database"); // Import SQLite db
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

// GET /api/schedule - Get scheduled sessions
router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `
      SELECT * FROM scheduled_sessions 
      WHERE user_id = ?
    `;
    let params = [req.user.id];

    if (from) {
      query += ` AND start_datetime >= ?`;
      params.push(from);
    }

    if (to) {
      query += ` AND start_datetime < ?`;
      params.push(to);
    }

    query += ` ORDER BY start_datetime ASC`;

    const stmt = db.prepare(query);
    const scheduledSessions = stmt.all(...params);

    res.json(scheduledSessions);
  } catch (error) {
    console.error('Error fetching scheduled sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/schedule - Create scheduled session
router.post("/", async (req, res) => {
  try {
    const { session_id = null, title = null, start_datetime, duration_min = 25 } = req.body || {};

    if (!start_datetime) {
      return res.status(400).json({ error: "start_datetime is required (ISO8601)" });
    }

    if (!session_id && !title) {
      return res.status(400).json({ error: "provide session_id or title" });
    }

    const stmt = db.prepare(`
      INSERT INTO scheduled_sessions (user_id, session_id, title, start_datetime, duration_min)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      req.user.id,
      session_id,
      title,
      start_datetime,
      duration_min
    );

    // Get the created scheduled session
    const getStmt = db.prepare('SELECT * FROM scheduled_sessions WHERE id = ?');
    const scheduledSession = getStmt.get(result.lastInsertRowid);

    res.status(201).json(scheduledSession);
  } catch (error) {
    console.error('Error creating scheduled session:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/schedule/:id - Update scheduled session
router.put("/:id", async (req, res) => {
  try {
    const { session_id, title, start_datetime, duration_min } = req.body;

    if (!start_datetime) {
      return res.status(400).json({ error: "start_datetime is required" });
    }

    const stmt = db.prepare(`
      UPDATE scheduled_sessions 
      SET session_id = ?, title = ?, start_datetime = ?, duration_min = ?
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(
      session_id || null,
      title || null,
      start_datetime,
      duration_min || 25,
      req.params.id,
      req.user.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Scheduled session not found" });
    }

    // Get the updated scheduled session
    const getStmt = db.prepare('SELECT * FROM scheduled_sessions WHERE id = ? AND user_id = ?');
    const scheduledSession = getStmt.get(req.params.id, req.user.id);

    res.json(scheduledSession);
  } catch (error) {
    console.error('Error updating scheduled session:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/schedule/:id - Delete scheduled session
router.delete("/:id", async (req, res) => {
  try {
    const stmt = db.prepare(`
      DELETE FROM scheduled_sessions 
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Scheduled session not found" });
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting scheduled session:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;