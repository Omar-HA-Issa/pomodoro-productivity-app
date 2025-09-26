const router = require("express").Router();
const { db } = require("../database");
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

// GET /api/schedule - Get scheduled sessions with template data
router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `
      SELECT 
        ss.*,
        s.name as session_name,
        s.focus_duration,
        s.break_duration,
        s.description as session_description
      FROM scheduled_sessions ss
      LEFT JOIN sessions s ON ss.session_id = s.id
      WHERE ss.user_id = ?
    `;
    let params = [req.user.id];

    if (from) {
      query += ` AND ss.start_datetime >= ?`;
      params.push(from);
    }
    if (to) {
      query += ` AND ss.start_datetime < ?`;
      params.push(to);
    }
    query += ` ORDER BY ss.start_datetime ASC`;

    const stmt = db.prepare(query);
    const sessions = stmt.all(...params);

    const result = sessions.map(s => ({
      id: s.id,
      session_id: s.session_id,
      title: s.title,
      start_datetime: s.start_datetime,
      duration_min: s.duration_min,
      completed: Boolean(s.completed), // Convert SQLite integer to boolean
      session: s.session_id ? {
        id: s.session_id,
        name: s.session_name,
        focus_duration: s.focus_duration,
        break_duration: s.break_duration,
        description: s.session_description
      } : null
    }));

    res.json(result);
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
      return res.status(400).json({ error: "start_datetime is required" });
    }
    if (!session_id && !title) {
      return res.status(400).json({ error: "provide session_id or title" });
    }

    // Validate session exists if session_id provided
    if (session_id) {
      const sessionCheck = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?');
      if (!sessionCheck.get(session_id, req.user.id)) {
        return res.status(400).json({ error: "Invalid session_id" });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO scheduled_sessions (user_id, session_id, title, start_datetime, duration_min, completed)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(req.user.id, session_id, title, start_datetime, duration_min, 0); // Default completed to 0

    // Return created session with template data
    const getQuery = `
      SELECT 
        ss.*,
        s.name as session_name,
        s.focus_duration,
        s.break_duration,
        s.description as session_description
      FROM scheduled_sessions ss
      LEFT JOIN sessions s ON ss.session_id = s.id
      WHERE ss.id = ?
    `;

    const created = db.prepare(getQuery).get(result.lastInsertRowid);

    const response = {
      id: created.id,
      session_id: created.session_id,
      title: created.title,
      start_datetime: created.start_datetime,
      duration_min: created.duration_min,
      completed: Boolean(created.completed), // Convert to boolean
      session: created.session_id ? {
        id: created.session_id,
        name: created.session_name,
        focus_duration: created.focus_duration,
        break_duration: created.break_duration,
        description: created.session_description
      } : null
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating scheduled session:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/schedule/:id - Update scheduled session
router.put("/:id", async (req, res) => {
  try {
    const { session_id, title, start_datetime, duration_min, completed } = req.body;

    if (!start_datetime) {
      return res.status(400).json({ error: "start_datetime is required" });
    }

    if (session_id) {
      const sessionCheck = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?');
      if (!sessionCheck.get(session_id, req.user.id)) {
        return res.status(400).json({ error: "Invalid session_id" });
      }
    }

    const stmt = db.prepare(`
      UPDATE scheduled_sessions 
      SET session_id = ?, title = ?, start_datetime = ?, duration_min = ?, completed = ?
      WHERE id = ? AND user_id = ?
    `);

    // Convert boolean to integer for SQLite compatibility
    const completedValue = completed ? 1 : 0;

    const result = stmt.run(
      session_id || null,
      title || null,
      start_datetime,
      duration_min || 25,
      completedValue,
      req.params.id,
      req.user.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Scheduled session not found" });
    }

    // Return updated session
    const getQuery = `
      SELECT 
        ss.*,
        s.name as session_name,
        s.focus_duration,
        s.break_duration,
        s.description as session_description
      FROM scheduled_sessions ss
      LEFT JOIN sessions s ON ss.session_id = s.id
      WHERE ss.id = ? AND ss.user_id = ?
    `;

    const updated = db.prepare(getQuery).get(req.params.id, req.user.id);

    const response = {
      id: updated.id,
      session_id: updated.session_id,
      title: updated.title,
      start_datetime: updated.start_datetime,
      duration_min: updated.duration_min,
      completed: Boolean(updated.completed), // Convert back to boolean
      session: updated.session_id ? {
        id: updated.session_id,
        name: updated.session_name,
        focus_duration: updated.focus_duration,
        break_duration: updated.break_duration,
        description: updated.session_description
      } : null
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating scheduled session:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/schedule/:id - Delete scheduled session
router.delete("/:id", async (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM scheduled_sessions WHERE id = ? AND user_id = ?');
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