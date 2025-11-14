jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 'test-user-sessions' };
    next();
  },
}));

const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

const auth = (r) => r.set('Authorization', 'Bearer test-token');
const userId = 'test-user-sessions';

function seedSession({
  name = 'Test',
  description = 'Seeded',
  focus = 25,
  brk = 5,
} = {}) {
  const info = db
    .prepare(
      `
    INSERT INTO sessions (user_id, name, description, focus_duration, break_duration)
    VALUES (?, ?, ?, ?, ?)
  `
    )
    .run(userId, name, description, focus, brk);
  return info.lastInsertRowid;
}

describe('Sessions API', () => {
  beforeEach(() => {
    try {
      db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
    } catch (e) {}
    try {
      db
        .prepare('DELETE FROM scheduled_sessions WHERE user_id = ?')
        .run(userId);
    } catch (e) {}
    try {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    } catch (e) {}
  });

  afterAll(() => {
    try {
      db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
    } catch (e) {}
    try {
      db
        .prepare('DELETE FROM scheduled_sessions WHERE user_id = ?')
        .run(userId);
    } catch (e) {}
    try {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    } catch (e) {}
  });

  describe('POST /api/sessions', () => {
    it('creates a session successfully', async () => {
      const res = await auth(request(app).post('/api/sessions')).send({
        name: 'Deep Work',
        focus_duration: 50,
        break_duration: 10,
        description: 'Long focus session',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Deep Work');
      expect(res.body.focus_duration).toBe(50);
      expect(res.body.break_duration).toBe(10);
    });

    it('validates required fields', async () => {
      const res = await auth(request(app).post('/api/sessions')).send({
        name: 'Incomplete',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/sessions', () => {
    it('returns empty array when no sessions', async () => {
      const res = await auth(request(app).get('/api/sessions'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('returns user sessions', async () => {
      seedSession({ name: 'Session1' });
      seedSession({ name: 'Session2' });

      const res = await auth(request(app).get('/api/sessions'));
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/sessions');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('gets a specific session', async () => {
      const id = seedSession({ name: 'GetMe' });
      const res = await auth(request(app).get(`/api/sessions/${id}`));
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('GetMe');
    });

    it('returns 404 for non-existent session', async () => {
      const res = await auth(request(app).get('/api/sessions/999999'));
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/sessions/:id', () => {
    it('updates a session', async () => {
      const id = seedSession({ name: 'Original', focus: 25, brk: 5 });

      const res = await auth(
        request(app).put(`/api/sessions/${id}`)
      ).send({
        name: 'Updated',
        focus_duration: 30,
        break_duration: 10,
      });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
      expect(res.body.focus_duration).toBe(30);
    });

    it('allows partial updates (only description)', async () => {
      const id = seedSession({
        name: 'Before',
        description: 'Old',
        focus: 25,
        brk: 5,
      });

      const res = await auth(
        request(app).put(`/api/sessions/${id}`)
      ).send({
        name: 'Before',
        focus_duration: 25,
        break_duration: 5,
        description: 'After',
      });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('After');
    });

    it('returns 404 for non-existent session', async () => {
      const res = await auth(
        request(app).put('/api/sessions/999999')
      ).send({
        name: 'Test',
        focus_duration: 25,
        break_duration: 5,
      });

      expect(res.status).toBe(404);
    });

    it('returns 400 when no updatable fields are provided', async () => {
      const id = seedSession({ name: 'Test' });

      const res = await auth(
        request(app).put(`/api/sessions/${id}`)
      ).send({});

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('deletes a session', async () => {
      const id = seedSession({ name: 'DeleteMe' });
      const res = await auth(
        request(app).delete(`/api/sessions/${id}`)
      );
      expect(res.status).toBe(204);

      const check = await auth(request(app).get(`/api/sessions/${id}`));
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await auth(
        request(app).delete('/api/sessions/999999')
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Sessions API - Additional Coverage', () => {
    it('validates focus_duration minimum value', async () => {
      const res = await auth(request(app).post('/api/sessions')).send({
        name: 'Test',
        focus_duration: 0,
        break_duration: 5,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Focus duration');
    });

    it('validates break_duration minimum value', async () => {
      const res = await auth(request(app).post('/api/sessions')).send({
        name: 'Test',
        focus_duration: 25,
        break_duration: 0,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Break duration');
    });

    it('handles missing focus_duration in update', async () => {
      const id = seedSession({ name: 'Test', focus: 25, brk: 5 });
      const res = await auth(
        request(app).put(`/api/sessions/${id}`)
      ).send({
        name: 'Test',
        break_duration: 5,
      });
      expect(res.status).toBe(400);
    });

    it('handles missing break_duration in update', async () => {
      const id = seedSession({ name: 'Test', focus: 25, brk: 5 });
      const res = await auth(
        request(app).put(`/api/sessions/${id}`)
      ).send({
        name: 'Test',
        focus_duration: 25,
      });
      expect(res.status).toBe(400);
    });
  });

  it('trims whitespace from name', async () => {
    const res = await auth(request(app).post('/api/sessions')).send({
      name: '  Whitespace Test  ',
      focus_duration: 25,
      break_duration: 5,
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Whitespace Test');
  });

  it('handles null description', async () => {
    const res = await auth(request(app).post('/api/sessions')).send({
      name: 'Test',
      focus_duration: 25,
      break_duration: 5,
      description: null,
    });

    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
  });

});
