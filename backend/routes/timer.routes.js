const express = require('express');
const TimerService = require('../services/timer.service');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const timerService = new TimerService();

// Small, single-purpose helper: HTTP error translation
function respondWithError(res, error, logMessage) {
  if (error && error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(logMessage, error);
  return res.status(500).json({ error: logMessage });
}

// All timer routes require an authenticated user
router.use(requireAuth);

// Only HTTP concerns here – business logic is in TimerService
router.get('/active', (req, res) => {
  try {
    const row = timerService.getActiveSession(req.user.id);
    res.json(row);
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch active timer');
  }
});

router.post('/start', (req, res) => {
  try {
    const timerSession = timerService.startTimer(req.user.id, req.body);
    res.status(201).json(timerSession);
  } catch (error) {
    respondWithError(res, error, 'Failed to start timer');
  }
});

router.post('/pause', (req, res) => {
  try {
    const session = timerService.pauseTimer(req.user.id);
    res.json(session);
  } catch (error) {
    respondWithError(res, error, 'Failed to pause timer');
  }
});

router.post('/resume', (req, res) => {
  try {
    const session = timerService.resumeTimer(req.user.id);
    res.json(session);
  } catch (error) {
    respondWithError(res, error, 'Failed to resume timer');
  }
});

router.post('/stop', (req, res) => {
  try {
    const session = timerService.stopTimer(req.user.id);
    res.json(session);
  } catch (error) {
    respondWithError(res, error, 'Failed to stop timer');
  }
});

router.post('/complete', (req, res) => {
  try {
    const session = timerService.completeTimer(
      req.user.id,
      req.body?.timer_id
    );
    res.json(session);
  } catch (error) {
    respondWithError(res, error, 'Failed to complete session');
  }
});

router.patch('/:id/notes', (req, res) => {
  try {
    const session = timerService.updateNotes(
      req.user.id,
      req.params.id,
      req.body?.notes ?? null
    );
    res.json(session);
  } catch (error) {
    respondWithError(res, error, 'Failed to update notes');
  }
});

router.get('/history', (req, res) => {
  try {
    const history = timerService.getHistory(req.user.id, req.query.limit);
    res.json(history);
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch history');
  }
});

module.exports = router;
