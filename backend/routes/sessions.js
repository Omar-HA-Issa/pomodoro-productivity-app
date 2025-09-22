const router = require("express").Router();
const db = require("../database");

router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM sessions ORDER BY datetime(created_at) DESC").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { title, target_pomodoros = 1, notes = null } = req.body || {};
  if (!title) return res.status(400).json({ error: "title is required" });

  const info = db
    .prepare("INSERT INTO sessions (title, target_pomodoros, notes) VALUES (?, ?, ?)")
    .run(title, target_pomodoros, notes);

  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { title, target_pomodoros = 1, notes = null } = req.body || {};
  const exists = db.prepare("SELECT id FROM sessions WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "not found" });

  db.prepare("UPDATE sessions SET title=?, target_pomodoros=?, notes=? WHERE id=?")
    .run(title, target_pomodoros, notes, id);

  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  res.status(204).end();
});

module.exports = router;
