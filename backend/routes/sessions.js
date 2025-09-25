const router = require("express").Router();
const { db } = require("../database"); // Import SQLite db
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

// GET /api/sessions - Get user's sessions
router.get("/", async (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM sessions 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    const sessions = stmt.all(req.user.id);

    res.json(sessions || []);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sessions - Create new session
router.post("/", async (req, res) => {
  try {
    const { name, focus_duration, break_duration, description } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!focus_duration || focus_duration < 1) {
      return res.status(400).json({ error: "Focus duration must be at least 1 minute" });
    }
    if (!break_duration || break_duration < 1) {
      return res.status(400).json({ error: "Break duration must be at least 1 minute" });
    }

    const stmt = db.prepare(`
      INSERT INTO sessions (user_id, name, focus_duration, break_duration, description)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      req.user.id,
      name.trim(),
      parseInt(focus_duration),
      parseInt(break_duration),
      description?.trim() || null
    );

    // Get the created session
    const getStmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const session = getStmt.get(result.lastInsertRowid);

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sessions/:id - Get specific session
router.get("/:id", async (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM sessions 
      WHERE id = ? AND user_id = ?
    `);
    const session = stmt.get(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/sessions/:id - Update session
router.put("/:id", async (req, res) => {
  try {
    const { name, focus_duration, break_duration, description } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!focus_duration || focus_duration < 1) {
      return res.status(400).json({ error: "Focus duration must be at least 1 minute" });
    }
    if (!break_duration || break_duration < 1) {
      return res.status(400).json({ error: "Break duration must be at least 1 minute" });
    }

    const stmt = db.prepare(`
      UPDATE sessions 
      SET name = ?, focus_duration = ?, break_duration = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(
      name.trim(),
      parseInt(focus_duration),
      parseInt(break_duration),
      description?.trim() || null,
      req.params.id,
      req.user.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Get the updated session
    const getStmt = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?');
    const session = getStmt.get(req.params.id, req.user.id);

    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sessions/:id - Delete session
router.delete("/:id", async (req, res) => {
  try {
    // First delete related records
    db.prepare('DELETE FROM timer_sessions WHERE session_template_id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    db.prepare('DELETE FROM scheduled_sessions WHERE session_id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    // Then delete the session
    const result = db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;