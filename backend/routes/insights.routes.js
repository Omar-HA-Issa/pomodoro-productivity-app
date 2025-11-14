const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const InsightsService = require('../services/insights.service');

const router = express.Router();
const insightsService = new InsightsService();

router.use(requireAuth);

function respondWithError(res, error, defaultMessage) {
  if (error && error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(defaultMessage, error);
  return res.status(500).json({ error: defaultMessage });
}

// GET /api/insights/completed-sessions
router.get('/completed-sessions', (req, res) => {
  try {
    const sessions = insightsService.listCompletedSessions(req.user.id);
    res.json({ sessions });
  } catch (err) {
    respondWithError(res, err, 'Failed to fetch completed sessions');
  }
});

// POST /api/insights/analyze
router.post('/analyze', (req, res) => {
  try {
    const result = insightsService.analyzeSession(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    respondWithError(res, err, 'Failed to analyze session');
  }
});

module.exports = router;
