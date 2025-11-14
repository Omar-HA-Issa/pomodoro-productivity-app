const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const DashboardService = require('../services/dashboard.service');

const router = express.Router();
const dashboardService = new DashboardService();

function respondWithError(res, error, defaultMessage) {
  if (error && error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(defaultMessage, error);
  return res.status(500).json({ error: defaultMessage });
}

router.use(requireAuth);

/**
 * GET /api/dashboard/streak
 * Returns streak metrics from completed timer_sessions.
 */
router.get('/streak', (req, res) => {
  try {
    const data = dashboardService.getStreakSummary(req.user.id);
    res.json(data);
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch streak data');
  }
});

/**
 * GET /api/dashboard/today-schedule
 * Returns today's schedule items formatted for the dashboard.
 */
router.get('/today-schedule', (req, res) => {
  try {
    const sessions = dashboardService.getTodaySchedule(req.user.id);
    res.json(sessions);
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch schedule');
  }
});

/**
 * GET /api/dashboard/stats
 * Returns simple 7-day stats.
 */
router.get('/stats', (req, res) => {
  try {
    const stats = dashboardService.getStats(req.user.id);
    res.json(stats);
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch statistics');
  }
});

/**
 * GET /api/dashboard/overview
 * Combined endpoint: streak, today's schedule, templates.
 */
router.get('/overview', (req, res) => {
  try {
    const data = dashboardService.getOverview(req.user.id);
    res.json(data);
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch dashboard data');
  }
});

module.exports = router;
