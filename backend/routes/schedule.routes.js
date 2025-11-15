const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const ScheduleService = require('../services/schedule.service');

router.use(requireAuth);

const scheduleService = new ScheduleService();

function respondWithError(res, error, defaultMessage) {
  if (error && error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(defaultMessage, error);
  return res.status(500).json({ error: defaultMessage });
}

// GET /api/schedule
router.get('/', (req, res) => {
  try {
    const items = scheduleService.list(req.user.id, req.query);
    res.json(items);
  } catch (error) {
    respondWithError(res, error, 'Error fetching scheduled sessions');
  }
});

// POST /api/schedule
router.post('/', (req, res) => {
  try {
    const created = scheduleService.create(req.user.id, req.body);
    res.status(201).json(created);
  } catch (error) {
    respondWithError(res, error, 'Error creating scheduled session');
  }
});

// PUT /api/schedule/:id
router.put('/:id', (req, res) => {
  try {
    const updated = scheduleService.update(req.user.id, req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    respondWithError(res, error, 'Error updating scheduled session');
  }
});

// DELETE /api/schedule/:id
router.delete('/:id', (req, res) => {
  try {
    scheduleService.delete(req.user.id, req.params.id);
    res.status(204).end();
  } catch (error) {
    respondWithError(res, error, 'Error deleting scheduled session');
  }
});

module.exports = router;
