require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRouter = require("./routes/auth");
const timerRouter = require("./routes/timer");
const sessionsRouter = require("./routes/sessions");
const scheduleRouter = require("./routes/schedule");
const dashboardRoutes = require('./routes/dashboard');
const { requireAuth } = require("./middleware/authMiddleware");
const insightsRoutes = require('./routes/insights');

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map(s => s.trim());

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/timer", requireAuth, timerRouter);
app.use("/api/sessions", requireAuth, sessionsRouter);
app.use("/api/schedule", requireAuth, scheduleRouter);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/insights', insightsRoutes);

// Export app for testing
module.exports = app;

// Only start server if this file is run directly (not imported by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`API on http://localhost:${PORT}`);
  });
}