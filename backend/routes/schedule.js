const router = require("express").Router();
const db = require("../database");

router.get("/", (req, res) => {
  const { from, to } = req.query;
  let q = "SELECT * FROM scheduled_sessions";
  const params = [];

  if (from || to) {
    q += " WHERE 1=1";
    if (from) { q += " AND datetime(start_datetime) >= datetime(?)"; params.push(from); }
    if (to)   { q += " AND datetime(start_datetime) < datetime(?)";  params.push(to); }
  }
  q += " ORDER BY datetime(start_datetime) ASC";
  const rows = db.prepare(q).all(...params);
  res.json(rows);
});

router.post("/", (req, res) => {
  const { session_id = null, title = null, start_datetime, duration_min = 25 } = req.body || {};
  if (!start_datetime) return res.status(400).json({ error: "start_datetime is required (ISO8601)" });
  if (!session_id && !title) return res.status(400).json({ error: "provide session_id or title" });

  const info = db.prepare(`
    INSERT INTO scheduled_sessions (session_id, title, start_datetime, duration_min)
    VALUES (?, ?, ?, ?)
  `).run(session_id, title, start_datetime, duration_min);

  const row = db.prepare("SELECT * FROM scheduled_sessions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM scheduled_sessions WHERE id = ?").run(id);
  res.status(204).end();
});

module.exports = router;
