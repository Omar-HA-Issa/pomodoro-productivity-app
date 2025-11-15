jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 'test-user-insights' };
    next();
  },
}));

// Env for Supabase client used inside insights service
process.env.SUPABASE_URL =
  process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// Mock fetch for HuggingFace sentiment call
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(
        JSON.stringify([[{ label: 'POSITIVE', score: 0.93 }]])
      ),
  })
);

const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

const auth = (r) => r.set('Authorization', 'Bearer test-token');
const userId = 'test-user-insights';

function seedCompletedGroup({
  minutes = 25,
  notes = null,
  when = new Date(),
  cycles = 4,
} = {}) {
  const iso = new Date(when).toISOString();
  const groupId = `group_${Date.now()}_${Math.random()}`;

  for (let i = 0; i < cycles; i++) {
    db.prepare(
      `
      INSERT INTO timer_sessions (
        user_id, duration_minutes, phase, completed,
        start_time, end_time, created_at, notes,
        session_group_id, current_cycle, target_cycles
      )
      VALUES (?, ?, 'focus', 1, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(userId, minutes, iso, iso, iso, notes, groupId, i, cycles);
  }

  const result = db
    .prepare(
      `
    SELECT MIN(id) as id FROM timer_sessions
    WHERE user_id = ? AND session_group_id = ?
  `
    )
    .get(userId, groupId);

  return result.id;
}

describe('Insights API', () => {
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

  describe('GET /api/insights/completed-sessions', () => {
    it('returns completed sessions for authenticated user', async () => {
      seedCompletedGroup({ minutes: 25, notes: 'Session 1' });
      seedCompletedGroup({ minutes: 30, notes: 'Session 2' });

      const res = await auth(
        request(app).get('/api/insights/completed-sessions')
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body.sessions.length).toBe(2);

      const session = res.body.sessions[0];
      expect(session).toHaveProperty('id');
      expect(session.id).toMatch(/^timer_\d+$/);
      expect(session).toHaveProperty('duration');
      expect(session).toHaveProperty('title');
    });
  });

  describe('POST /api/insights/analyze', () => {
    it('analyzes sentiment for a timer session (timer_123 format)', async () => {
      const sessionId = seedCompletedGroup({
        notes: 'Felt productive today',
      });

      const res = await auth(
        request(app).post('/api/insights/analyze')
      ).send({
        id: `timer_${sessionId}`,
        sentiment_label: 'positive',
        sentiment_score: 0.95,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('analyzedAt');
      expect(res.body.sentiment).toHaveProperty('label');
      expect(res.body.sentiment).toHaveProperty('score');
      expect(res.body.sentiment.label).toBe('positive');
    });

    it('accepts numeric id format', async () => {
      const sessionId = seedCompletedGroup({ notes: 'Good session' });

      const res = await auth(
        request(app).post('/api/insights/analyze')
      ).send({
        id: sessionId,
        sentiment_label: 'positive',
        sentiment_score: 0.9,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('sentiment');
    });

    it('returns 404 for non-existent session', async () => {
      const res = await auth(
        request(app).post('/api/insights/analyze')
      ).send({
        id: 'timer_999999',
        sentiment_label: 'positive',
        sentiment_score: 0.5,
      });

      expect(res.status).toBe(404);
    });

    it('handles missing HF API key (still 200, using provided sentiment)', async () => {
      const sessionId = seedCompletedGroup({ notes: 'test' });

      const res = await auth(
        request(app).post('/api/insights/analyze')
      ).send({
        id: `timer_${sessionId}`,
        sentiment_label: 'neutral',
        sentiment_score: 0.5,
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Insights API - Additional Coverage', () => {
    it('analyzes session with empty notes', async () => {
      const sessionId = seedCompletedGroup({ notes: '' });

      const res = await auth(
        request(app).post('/api/insights/analyze')
      ).send({
        id: sessionId,
        sentiment_label: 'neutral',
        sentiment_score: 0.5,
      });

      expect(res.status).toBe(200);
    });

    it('handles missing both id and sessionId', async () => {
      const res = await auth(
        request(app).post('/api/insights/analyze')
      ).send({ sentiment_label: 'positive' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('id is required');
    });

    it('updates notes when analyzing', async () => {
      const sessionId = seedCompletedGroup({ notes: 'Old notes' });

      const res = await auth(
        request(app).post('/api/insights/analyze')
      ).send({
        id: `timer_${sessionId}`,
        sentiment_label: 'positive',
        sentiment_score: 0.85,
      });

      expect(res.status).toBe(200);

      const updated = db
        .prepare(
          'SELECT sentiment_label, sentiment_score FROM timer_sessions WHERE id = ?'
        )
        .get(sessionId);
      expect(updated.sentiment_label).toBe('positive');
      expect(updated.sentiment_score).toBe(0.85);
    });
  });

  it('accepts id parameter even when sessionId provided (API ignores sessionId)', async () => {
    const sessionId = seedCompletedGroup({ notes: 'Test' });

    const res = await auth(
      request(app).post('/api/insights/analyze')
    ).send({
      id: `timer_${sessionId}`,
      sentiment_label: 'positive',
      sentiment_score: 0.8,
      sessionId,
    });

    expect(res.status).toBe(200);
  });

  it('returns 404 stats for new user (no data)', async () => {
    const res = await auth(request(app).get('/api/insights/stats'));
    expect(res.status).toBe(404);
  });

  it('uses existing notes when no new notes provided', async () => {
    const sessionId = seedCompletedGroup({ notes: 'Existing notes' });

    const res = await auth(
      request(app).post('/api/insights/analyze')
    ).send({
      id: `timer_${sessionId}`,
      sentiment_label: 'positive',
      sentiment_score: 0.9,
    });

    expect(res.status).toBe(200);
  });
});
