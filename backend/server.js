require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRouter = require("./routes/auth");
const timerRouter = require("./routes/timer");
const sessionsRouter = require("./routes/sessions");
const scheduleRouter = require("./routes/schedule");

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5176")
  .split(",")
  .map(s => s.trim());

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/timer", timerRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/schedule", scheduleRouter);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});