// Mock auth BEFORE requiring server
jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 'test-user-timer' }; // Unique ID
    next();
  },
}));

const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

const auth = (r) => r.set('Authorization', 'Bearer test-token');
const userId = 'test-user-timer'; // Unique ID for timer tests

function seedTemplate({ name = 'TestTemplate', focus = 25, brk = 5 } = {}) {
  const info = db
    .prepare(
      `INSERT INTO sessions (user_id, name, description, focus_duration, break_duration)
       VALUES (?, ?, '', ?, ?)`
    )
    .run(userId, name, focus, brk);
  return info.lastInsertRowid;
}

describe('Timer API', () => {
  beforeEach(() => {
    // Clean in correct order - children first
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
    it('starts a new timer with template', async () => {
      const sessionTemplateId = seedTemplate({ name: 'Focus', focus: 25, brk: 5 });

      const res = await auth(request(app).post('/api/timer/start')).send({
        session_template_id: sessionTemplateId,
        duration_minutes: 25,
        phase: 'focus',
      });

      expect(res.status).toBe(201);
      expect(res.body.session_template_id).toBe(sessionTemplateId);
      expect(res.body.duration_minutes).toBe(25);
      expect(res.body.phase).toBe('focus');
    });

    it('starts a timer without template', async () => {
      const res = await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 30,
        phase: 'focus',
      });

      expect(res.status).toBe(201);
      expect(res.body.duration_minutes).toBe(30);
      expect(res.body.phase).toBe('focus');
      expect(res.body.session_template_id).toBeNull();
    });
  });

  describe('GET /api/timer/active', () => {
    it('returns null when no active timer', async () => {
      const res = await auth(request(app).get('/api/timer/active'));
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('returns active timer', async () => {
      await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 25,
        phase: 'focus',
      });

      const res = await auth(request(app).get('/api/timer/active'));
      expect(res.status).toBe(200);
      expect(res.body).not.toBeNull();
      expect(res.body.duration_minutes).toBe(25);
    });
  });

  describe('POST /api/timer/pause', () => {
    it('pauses a timer', async () => {
      const startRes = await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 25,
        phase: 'focus',
      });

      expect(startRes.status).toBe(201);
      expect(startRes.body.id).toBeDefined();
      const timerId = startRes.body.id;

      const res = await auth(request(app).post('/api/timer/pause')).send({
        timer_id: timerId,
      });

      expect(res.status).toBe(200);
      expect(res.body.paused).toBe(1);
    });

    it('returns 404 for non-existent timer', async () => {
      const res = await auth(request(app).post('/api/timer/pause')).send({
        timer_id: 99999,
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/timer/resume', () => {
    it('resumes a paused timer', async () => {
      const startRes = await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 25,
        phase: 'focus',
      });
      expect(startRes.status).toBe(201);
      const timerId = startRes.body.id;

      const pauseRes = await auth(request(app).post('/api/timer/pause')).send({ timer_id: timerId });
      expect(pauseRes.status).toBe(200);

      const res = await auth(request(app).post('/api/timer/resume')).send({
        timer_id: timerId,
      });

      expect(res.status).toBe(200);
      expect(res.body.paused).toBe(0);
    });
  });

  describe('POST /api/timer/stop', () => {
    it('stops and completes a timer', async () => {
      const startRes = await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 25,
        phase: 'focus',
      });
      expect(startRes.status).toBe(201);
      const timerId = startRes.body.id;

      const res = await auth(request(app).post('/api/timer/stop')).send({
        timer_id: timerId,
      });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(1);
      expect(res.body.end_time).toBeDefined();
    });
  });

  describe('POST /api/timer/complete', () => {
    it('marks timer as complete', async () => {
      const startRes = await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 25,
        phase: 'focus',
      });
      expect(startRes.status).toBe(201);
      const timerId = startRes.body.id;

      const res = await auth(request(app).post('/api/timer/complete')).send({
        timer_id: timerId,
      });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(1);
      expect(res.body.end_time).toBeDefined();
    });
  });

  describe('Timer API - Additional Coverage', () => {
    it('creates timer with custom cycles', async () => {
      const res = await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 25,
        phase: 'focus',
        current_cycle: 1,
        target_cycles: 8,
      });

      expect(res.status).toBe(201);
      expect(res.body.current_cycle).toBe(1);
      expect(res.body.target_cycles).toBe(8);
    });

    it('creates timer with short_break phase', async () => {
      const res = await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 5,
        phase: 'short_break',
      });

      expect(res.status).toBe(201);
      expect(res.body.phase).toBe('short_break');
    });

    it('creates timer with long_break phase', async () => {
      const res = await auth(request(app).post('/api/timer/start')).send({
        duration_minutes: 15,
        phase: 'long_break',
      });

      expect(res.status).toBe(201);
      expect(res.body.phase).toBe('long_break');
    });
  });

  it('defaults to focus phase when not specified', async () => {
    const res = await auth(request(app).post('/api/timer/start')).send({
      duration_minutes: 25,
      // phase not specified, should default to 'focus'
    });

    expect(res.status).toBe(201);
    expect(res.body.phase).toBe('focus');
  });

  it('defaults cycles when not specified', async () => {
    const res = await auth(request(app).post('/api/timer/start')).send({
      duration_minutes: 25,
      phase: 'focus',
    });

    expect(res.status).toBe(201);
    expect(res.body.current_cycle).toBe(0);
    expect(res.body.target_cycles).toBe(4);
  });
});