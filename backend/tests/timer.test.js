// Mock auth BEFORE requiring server
jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 'test-user-timer' };
    next();
  },
}));

const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

const auth = (r) => r.set('Authorization', 'Bearer test-token');
const userId = 'test-user-timer';

function seedTemplate({ name = 'TestTemplate', focus = 25, brk = 5 } = {}) {
  const info = db.prepare(
    `INSERT INTO sessions (user_id, name, description, focus_duration, break_duration)
     VALUES (?, ?, '', ?, ?)`
  ).run(userId, name, focus, brk);
  return info.lastInsertRowid;
}

async function startTimer(overrides = {}) {
  const defaults = { duration_minutes: 25, phase: 'focus' };
  return auth(request(app).post('/api/timer/start')).send({ ...defaults, ...overrides });
}

describe('Timer API', () => {
  beforeEach(() => {
    try { db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId); } catch (e) {}
    try { db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId); } catch (e) {}
    try { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); } catch (e) {}
  });

  afterAll(() => {
    try { db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId); } catch (e) {}
    try { db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId); } catch (e) {}
    try { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); } catch (e) {}
  });

  describe('POST /api/timer/start', () => {
    it('starts timer with template', async () => {
      const templateId = seedTemplate({ name: 'Focus', focus: 25, brk: 5 });
      const res = await startTimer({ session_template_id: templateId });

      expect(res.status).toBe(201);
      expect(res.body.session_template_id).toBe(templateId);
      expect(res.body.duration_minutes).toBe(25);
    });

    it('starts timer without template', async () => {
      const res = await startTimer({ duration_minutes: 30 });
      expect(res.status).toBe(201);
      expect(res.body.session_template_id).toBeNull();
    });

    it('defaults to focus phase when not specified', async () => {
      const res = await startTimer();
      expect(res.status).toBe(201);
      expect(res.body.phase).toBe('focus');
    });

    it('defaults cycles when not specified', async () => {
      const res = await startTimer();
      expect(res.status).toBe(201);
      expect(res.body.current_cycle).toBe(0);
      expect(res.body.target_cycles).toBe(4);
    });

    it.each([
      ['short_break', 5],
      ['long_break', 15],
      ['focus', 25],
    ])('creates timer with %s phase', async (phase, minutes) => {
      const res = await startTimer({ duration_minutes: minutes, phase });
      expect(res.status).toBe(201);
      expect(res.body.phase).toBe(phase);
    });

    it('creates timer with custom cycles', async () => {
      const res = await startTimer({ current_cycle: 1, target_cycles: 8 });
      expect(res.status).toBe(201);
      expect(res.body.current_cycle).toBe(1);
      expect(res.body.target_cycles).toBe(8);
    });

    it('starts timer with session_group_id', async () => {
      const groupId = `group_${Date.now()}`;
      const res = await startTimer({ session_group_id: groupId, current_cycle: 1, target_cycles: 4 });
      expect(res.status).toBe(201);
      expect(res.body.session_group_id).toBe(groupId);
    });

    it.each([
      [{ phase: 'focus' }, 'duration_minutes'],
      [{ duration_minutes: 'not-a-number', phase: 'focus' }, 'duration_minutes'],
      [{ duration_minutes: 25, phase: 'invalid_phase' }, 'Invalid phase'],
    ])('validates start request: %j', async (payload, errorMsg) => {
      const res = await auth(request(app).post('/api/timer/start')).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain(errorMsg);
    });
  });

  describe('GET /api/timer/active', () => {
    it('returns null when no active timer', async () => {
      const res = await auth(request(app).get('/api/timer/active'));
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('returns active timer', async () => {
      await startTimer();
      const res = await auth(request(app).get('/api/timer/active'));
      expect(res.status).toBe(200);
      expect(res.body).not.toBeNull();
      expect(res.body.duration_minutes).toBe(25);
    });
  });

  describe('Timer control endpoints', () => {
    it.each([
      ['pause', 'paused', 1],
      ['resume', 'paused', 0],
      ['stop', 'completed', 1],
    ])('%s timer successfully', async (action, field, expectedValue) => {
      await startTimer();
      if (action === 'resume') await auth(request(app).post('/api/timer/pause'));

      const res = await auth(request(app).post(`/api/timer/${action}`));
      expect(res.status).toBe(200);
      expect(res.body[field]).toBe(expectedValue);
      if (action === 'stop') expect(res.body.end_time).toBeDefined();
    });

    it.each(['pause', 'resume', 'stop'])(
      'returns 404 for %s with no active timer',
      async (action) => {
        const res = await auth(request(app).post(`/api/timer/${action}`));
        expect(res.status).toBe(404);
        expect(res.body.error).toContain('No active timer');
      }
    );
  });

  describe('POST /api/timer/complete', () => {
    it('marks timer as complete', async () => {
      const { body: { id } } = await startTimer();
      const res = await auth(request(app).post('/api/timer/complete')).send({ timer_id: id });
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(1);
      expect(res.body.end_time).toBeDefined();
    });

    it('requires timer_id', async () => {
      const res = await auth(request(app).post('/api/timer/complete')).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('timer_id');
    });

    it('returns 404 for non-existent timer', async () => {
      const res = await auth(request(app).post('/api/timer/complete')).send({ timer_id: 999999 });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('PATCH /api/timer/:id/notes', () => {
    it('updates notes on timer session', async () => {
      const { body: { id } } = await startTimer();
      const res = await auth(request(app).patch(`/api/timer/${id}/notes`))
        .send({ notes: 'Great focus session!' });
      expect(res.status).toBe(200);
      expect(res.body.notes).toBe('Great focus session!');
    });

    it('returns 404 for non-existent timer', async () => {
      const res = await auth(request(app).patch('/api/timer/999999/notes'))
        .send({ notes: 'Test notes' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/timer/history', () => {
    it('fetches timer history', async () => {
      const { body: { id } } = await startTimer();
      await auth(request(app).post('/api/timer/complete')).send({ timer_id: id });

      const res = await auth(request(app).get('/api/timer/history'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('fetches history with custom limit', async () => {
      const res = await auth(request(app).get('/api/timer/history?limit=10'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});