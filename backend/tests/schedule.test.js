jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 'test-user-schedule' }; // Unique ID
    next();
  },
}));

const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

const auth = (r) => r.set('Authorization', 'Bearer test-token');
const userId = 'test-user-schedule'; // Unique ID for schedule tests

function seedTemplate({ name = 'Template', focus = 25, brk = 5 } = {}) {
  const info = db.prepare(`
    INSERT INTO sessions (user_id, name, description, focus_duration, break_duration)
    VALUES (?, ?, '', ?, ?)
  `).run(userId, name, focus, brk);
  return info.lastInsertRowid;
}

function seedSchedule({ title = 'Meeting', start = '2025-10-15T10:00:00Z', sessionId = null } = {}) {
  const info = db.prepare(`
    INSERT INTO scheduled_sessions (user_id, session_id, title, start_datetime)
    VALUES (?, ?, ?, ?)
  `).run(userId, sessionId, title, start);
  return info.lastInsertRowid;
}

describe('Schedule API', () => {
  beforeEach(() => {
    // Clean in correct order
    try { db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId); } catch (e) {}
    try { db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId); } catch (e) {}
    try { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); } catch (e) {}
  });

  afterAll(() => {
    try { db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId); } catch (e) {}
    try { db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId); } catch (e) {}
    try { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); } catch (e) {}
  });

  describe('POST /api/schedule', () => {
    it('creates scheduled session with session_id', async () => {
      const sessionId = seedTemplate({ name: 'Focus', focus: 25, brk: 5 });

      const res = await auth(request(app).post('/api/schedule')).send({
        session_id: sessionId,
        start_datetime: '2025-10-15T10:00:00Z',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.session_id).toBe(sessionId);
      expect(res.body.start_datetime).toBe('2025-10-15T10:00:00Z');
    });

    it('creates scheduled session with title only', async () => {
      const res = await auth(request(app).post('/api/schedule')).send({
        title: 'Team Meeting',
        start_datetime: '2025-10-15T14:00:00Z',
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Team Meeting');
    });

    it('validates required fields', async () => {
      const res = await auth(request(app).post('/api/schedule')).send({
        title: 'Missing datetime',
      });

      expect(res.status).toBe(400);
    });

    it('validates session_id exists (non-existent id => 400)', async () => {
      const res = await auth(request(app).post('/api/schedule')).send({
        session_id: 999999,
        start_datetime: '2025-10-15T10:00:00Z',
      });

      expect(res.status).toBe(400);
    });

    it('rejects non-numeric session_id type (string)', async () => {
      const res = await auth(request(app).post('/api/schedule')).send({
        session_id: 'not-a-number',
        start_datetime: '2025-10-15T10:00:00Z',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/schedule', () => {
    it('returns empty array when no sessions', async () => {
      const res = await auth(request(app).get('/api/schedule'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('returns scheduled sessions', async () => {
      seedSchedule({ title: 'Meeting 1', start: '2025-10-15T10:00:00Z' });
      seedSchedule({ title: 'Meeting 2', start: '2025-10-16T14:00:00Z' });

      const res = await auth(request(app).get('/api/schedule'));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by date range', async () => {
      seedSchedule({ title: 'Early', start: '2025-10-01T10:00:00Z' });
      seedSchedule({ title: 'Mid', start: '2025-10-15T10:00:00Z' });
      seedSchedule({ title: 'Late', start: '2025-10-30T10:00:00Z' });

      const res = await auth(request(app).get('/api/schedule'))
        .query({ from: '2025-10-10', to: '2025-10-20' });

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Mid');
    });
  });

  describe('PUT /api/schedule/:id', () => {
    it('updates scheduled session', async () => {
      const id = seedSchedule({title: 'Original', start: '2025-10-15T10:00:00Z'});

      const res = await auth(request(app).put(`/api/schedule/${id}`)).send({
        title: 'Updated',
        start_datetime: '2025-10-15T11:00:00Z',
      });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('returns 404 for non-existent session', async () => {
      const res = await auth(request(app).put('/api/schedule/999999')).send({
        start_datetime: '2025-10-15T14:00:00Z',
        title: 'Test',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/schedule/:id', () => {
    it('deletes scheduled session', async () => {
      const id = seedSchedule({title: 'DeleteMe'});

      const res = await auth(request(app).delete(`/api/schedule/${id}`));
      expect(res.status).toBe(204);

      const check = await auth(request(app).get(`/api/schedule`));
      const found = check.body.find(s => s.id === id);
      expect(found).toBeUndefined();
    });

    it('returns 404 for non-existent session', async () => {
      const res = await auth(request(app).delete('/api/schedule/999999'));
      expect(res.status).toBe(404);
    });
  });

  describe('Schedule API - Additional Coverage', () => {
    it('creates scheduled session without optional duration_min', async () => {
      const res = await auth(request(app).post('/api/schedule')).send({
        title: 'Meeting',
        start_datetime: '2025-10-20T10:00:00Z',
        // duration_min not provided, should default to 25
      });
      expect(res.status).toBe(201);
      expect(res.body.duration_min).toBe(25);
    });

    it('handles session_id of wrong type (string) validation', async () => {
      const res = await auth(request(app).post('/api/schedule')).send({
        session_id: 'not-a-number',
        start_datetime: '2025-10-20T10:00:00Z',
      });
      expect(res.status).toBe(400);
    });

    it('filters schedule with only from parameter', async () => {
      seedSchedule({title: 'Early', start: '2025-10-01T10:00:00Z'});
      seedSchedule({title: 'Late', start: '2025-10-30T10:00:00Z'});

      const res = await auth(request(app).get('/api/schedule'))
          .query({from: '2025-10-15'});

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Late');
    });

    it('filters schedule with only to parameter', async () => {
      seedSchedule({title: 'Early', start: '2025-10-01T10:00:00Z'});
      seedSchedule({title: 'Late', start: '2025-10-30T10:00:00Z'});

      const res = await auth(request(app).get('/api/schedule'))
          .query({to: '2025-10-15'});

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Early');
    });

    it('updates schedule with all fields including completed', async () => {
      const sessionId = seedTemplate({name: 'Template', focus: 30, brk: 10});
      const scheduleId = seedSchedule({title: 'Original', start: '2025-10-20T10:00:00Z'});

      const res = await auth(request(app).put(`/api/schedule/${scheduleId}`)).send({
        session_id: sessionId,
        title: 'Updated',
        start_datetime: '2025-10-20T11:00:00Z',
        duration_min: 30,
        completed: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
    });
  });

  it('returns session with null template when session_id not provided', async () => {
    const scheduleId = seedSchedule({title: 'Standalone', start: '2025-10-20T10:00:00Z', sessionId: null});

    const res = await auth(request(app).get('/api/schedule'));
    expect(res.status).toBe(200);

    const found = res.body.find(s => s.id === scheduleId);
    expect(found).toBeDefined();
    expect(found.session).toBeNull();
  });

  it('validates missing both session_id and title', async () => {
    const res = await auth(request(app).post('/api/schedule')).send({
      start_datetime: '2025-10-20T10:00:00Z',
      // Missing both session_id and title
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('provide session_id or title');
  });
});