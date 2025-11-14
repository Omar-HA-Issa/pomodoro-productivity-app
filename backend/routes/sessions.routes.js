const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const SessionService = require('../services/sessions.service');

router.use(requireAuth);

const sessionService = new SessionService();

function respondWithError(res, error, defaultMessage) {
  if (error && error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(defaultMessage, error);
  return res.status(500).json({ error: defaultMessage });
}

// GET /api/sessions
router.get('/', (req, res) => {
  try {
    const sessions = sessionService.listSessions(req.user.id);
    res.json(sessions);
  } catch (error) {
    respondWithError(res, error, 'Error fetching sessions');
  }
});

// POST /api/sessions
router.post('/', (req, res) => {
  try {
    const session = sessionService.createSession(req.user.id, req.body);
    res.status(201).json(session);
  } catch (error) {
    respondWithError(res, error, 'Error creating session');
  }
});

// GET /api/sessions/:id  (optional but useful)
router.get('/:id', (req, res) => {
  try {
    const session = sessionService.getSession(req.user.id, req.params.id);
    res.json(session);
  } catch (error) {
    respondWithError(res, error, 'Error fetching session');
  }
});

// PUT /api/sessions/:id
router.put('/:id', (req, res) => {
  try {
    const session = sessionService.updateSession(req.user.id, req.params.id, req.body);
    res.json(session);
  } catch (error) {
    respondWithError(res, error, 'Error updating session');
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', (req, res) => {
  try {
    sessionService.deleteSession(req.user.id, req.params.id);
    res.status(204).end();
  } catch (error) {
    respondWithError(res, error, 'Error deleting session');
  }
});

module.exports = router;
