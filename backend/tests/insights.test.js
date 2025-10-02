// Mock auth BEFORE requiring anything
jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 'test-user-insights' }; // Unique ID
    next();
  },
}));

// Set environment variables
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// Mock fetch for Hugging Face API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify([[{ label: 'POSITIVE', score: 0.93 }]])),
  })
);

const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

const auth = (r) => r.set('Authorization', 'Bearer test-token');
const userId = 'test-user-insights'; // Unique ID for insights tests

function seedCompletedTimer({ minutes = 25, notes = null, when = new Date() } = {}) {
  const iso = new Date(when).toISOString();
  const info = db.prepare(`
    INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, end_time, created_at, notes)
    VALUES (?, ?, 'focus', 1, ?, ?, ?, ?)
  `).run(userId, minutes, iso, iso, iso, notes);
  return info.lastInsertRowid;
}

describe('Insights API', () => {
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

  describe('GET /api/insights/completed-sessions', () => {
    it('returns completed sessions for authenticated user', async () => {
      // Seed exactly 2 completed sessions
      seedCompletedTimer({ minutes: 25, notes: 'Session 1' });
      seedCompletedTimer({ minutes: 30, notes: 'Session 2' });

      const res = await auth(request(app).get('/api/insights/completed-sessions'));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body.sessions.length).toBe(2);

      const session = res.body.sessions[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('duration'); // API returns 'duration' not 'duration_minutes'
      expect(session).toHaveProperty('title');
    });
  });

  describe('POST /api/insights/analyze', () => {
    it('analyzes sentiment for a timer session (timer_123 format)', async () => {
      // Set HF_API_KEY for this test
      const originalKey = process.env.HUGGING_FACE_API_KEY;
      process.env.HUGGING_FACE_API_KEY = 'test-hf-key';

      const sessionId = seedCompletedTimer({ notes: 'Felt productive today' });

      const res = await auth(request(app).post('/api/insights/analyze'))
        .send({ id: `timer_${sessionId}`, notes: 'Felt productive today' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sentiment).toHaveProperty('label');
      expect(res.body.sentiment).toHaveProperty('score');

      // Restore original key
      process.env.HUGGING_FACE_API_KEY = originalKey;
    });

    it('accepts numeric id format', async () => {
      const originalKey = process.env.HUGGING_FACE_API_KEY;
      process.env.HUGGING_FACE_API_KEY = 'test-hf-key';

      const sessionId = seedCompletedTimer({ notes: 'Good session' });

      const res = await auth(request(app).post('/api/insights/analyze'))
        .send({ id: sessionId, notes: 'Good session' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      process.env.HUGGING_FACE_API_KEY = originalKey;
    });

    it('rejects invalid session id format', async () => {
      const res = await auth(request(app).post('/api/insights/analyze'))
        .send({ id: 'invalid_format', notes: 'test' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await auth(request(app).post('/api/insights/analyze'))
        .send({ id: 'timer_999999', notes: 'test' });

      expect(res.status).toBe(404);
    });

    it('handles missing HF API key', async () => {
      const originalKey = process.env.HUGGING_FACE_API_KEY;
      delete process.env.HUGGING_FACE_API_KEY;

      const sessionId = seedCompletedTimer({ notes: 'test' });

      const res = await auth(request(app).post('/api/insights/analyze'))
        .send({ id: `timer_${sessionId}`, notes: 'test' });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');

      process.env.HUGGING_FACE_API_KEY = originalKey;
    });
  });

  describe('GET /api/insights/stats', () => {
    it('returns insight statistics', async () => {
      seedCompletedTimer({ minutes: 25, notes: 'Good work' });
      seedCompletedTimer({ minutes: 30, notes: 'Very productive' });

      const res = await auth(request(app).get('/api/insights/stats'));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('completed');
      expect(res.body).toHaveProperty('positive');
      expect(res.body).toHaveProperty('neutral');
      expect(res.body).toHaveProperty('negative');

      expect(res.body.total).toBe(2);
      expect(res.body.completed).toBe(2);
    });
  });

  describe('Insights API - Additional Coverage', () => {
    it('analyzes session with empty notes', async () => {
      const originalKey = process.env.HUGGING_FACE_API_KEY;
      process.env.HUGGING_FACE_API_KEY = 'test-hf-key';

      const sessionId = seedCompletedTimer({notes: ''});

      const res = await auth(request(app).post('/api/insights/analyze'))
          .send({id: sessionId, notes: ''});

      expect(res.status).toBe(200);
      process.env.HUGGING_FACE_API_KEY = originalKey;
    });

    it('handles missing both id and sessionId', async () => {
      const res = await auth(request(app).post('/api/insights/analyze'))
          .send({notes: 'Test'});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing session id');
    });

    it('rejects invalid timer id format (no underscore)', async () => {
      const res = await auth(request(app).post('/api/insights/analyze'))
          .send({id: 'invalid123', notes: 'test'});

      expect(res.status).toBe(400);
    });

    it('updates notes when analyzing', async () => {
      const originalKey = process.env.HUGGING_FACE_API_KEY;
      process.env.HUGGING_FACE_API_KEY = 'test-hf-key';

      const sessionId = seedCompletedTimer({notes: 'Old notes'});

      const res = await auth(request(app).post('/api/insights/analyze'))
          .send({id: `timer_${sessionId}`, notes: 'New notes'});

      expect(res.status).toBe(200);

      // Verify notes were updated
      const updated = db.prepare('SELECT notes FROM timer_sessions WHERE id = ?').get(sessionId);
      expect(updated.notes).toBe('New notes');

      process.env.HUGGING_FACE_API_KEY = originalKey;
    });
  });

  it('handles sessionId parameter as alternative to id', async () => {
    const originalKey = process.env.HUGGING_FACE_API_KEY;
    process.env.HUGGING_FACE_API_KEY = 'test-hf-key';

    const sessionId = seedCompletedTimer({notes: 'Test'});

    const res = await auth(request(app).post('/api/insights/analyze'))
        .send({sessionId: `timer_${sessionId}`, notes: 'Test'});

    expect(res.status).toBe(200);
    process.env.HUGGING_FACE_API_KEY = originalKey;
  });

  it('uses existing notes when no new notes provided', async () => {
    const originalKey = process.env.HUGGING_FACE_API_KEY;
    process.env.HUGGING_FACE_API_KEY = 'test-hf-key';

    const sessionId = seedCompletedTimer({notes: 'Existing notes'});

    const res = await auth(request(app).post('/api/insights/analyze'))
        .send({id: `timer_${sessionId}`}); // No notes provided

    expect(res.status).toBe(200);
    process.env.HUGGING_FACE_API_KEY = originalKey;
  });

  it('returns stats with all zero values for new user', async () => {
    // Don't seed any data
    const res = await auth(request(app).get('/api/insights/stats'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.completed).toBe(0);
    expect(res.body.analyzed).toBe(0);
  });

});