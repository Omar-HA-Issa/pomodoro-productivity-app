const router = require("express").Router();

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const timer = { running: false, phase: "idle", remainingMs: 0, cycle: 0 };

router.get("/status", (_req, res) => res.json(timer));

router.post("/start", (req, res) => {
  const phase = req.body?.phase === "break" ? "break" : "focus";
  timer.running = true;
  timer.phase = phase;
  timer.remainingMs = phase === "focus" ? FOCUS_MS : BREAK_MS;
  if (phase === "focus") timer.cycle += 1;
  res.json(timer);
});

router.post("/stop", (_req, res) => {
  timer.running = false;
  timer.phase = "idle";
  timer.remainingMs = 0;
  res.json(timer);
});

module.exports = router;
