require("dotenv").config();
const express = require("express");
const cors = require("cors");
const client = require("prom-client");

const authRouter = require("./routes/auth");
const timerRouter = require("./routes/timer.routes");
const sessionsRouter = require("./routes/sessions.routes");
const scheduleRouter = require("./routes/schedule.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const { requireAuth } = require("./middleware/authMiddleware");
const insightsRoutes = require("./routes/insights.routes");

const app = express();


// CORS CONFIG
const corsOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://localhost:5174"
)
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());



//PROMETHEUS METRICS
client.collectDefaultMetrics();

const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const httpErrorCounter = new client.Counter({
  name: "http_errors_total",
  help: "Total HTTP errors",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

// Metrics middleware
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationSec = Number(durationNs) / 1e9;

    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    };

    httpRequestCounter.inc(labels);
    httpRequestDuration.observe(labels, durationSec);

    if (res.statusCode >= 500) {
      httpErrorCounter.inc(labels);
    }
  });

  next();
});


//HEALTH + METRICS
const healthHandler = (_req, res) => {
  res.status(200).json({
    status: "ok",
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    console.error("Error generating metrics:", err);
    res.status(500).end();
  }
});

// ROUTES
app.use("/api/auth", authRouter);
app.use("/api/timer", requireAuth, timerRouter);
app.use("/api/sessions", requireAuth, sessionsRouter);
app.use("/api/schedule", requireAuth, scheduleRouter);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/insights", insightsRoutes);

module.exports = app;

//SERVER START
if (require.main === module) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`API on http://localhost:${PORT}`);
  });
}
