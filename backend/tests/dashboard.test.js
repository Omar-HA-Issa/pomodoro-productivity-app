const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

describe('Dashboard API', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const testEmail = `test.dashboard.${Date.now()}@testmail.com`;
    const testPassword = 'TestPass123!';

    await request(app)
      .post('/api/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        first_name: 'Dashboard',
        last_name: 'Test'
      });

    const signinResponse = await request(app)
      .post('/api/auth/signin')
      .send({
        email: testEmail,
        password: testPassword
      });

    authToken = signinResponse.body.session.access_token;
    userId = signinResponse.body.user.id;
  });

  afterAll(() => {
    if (userId) {
      db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    }
  });

  describe('GET /api/dashboard/streak', () => {
    it('should return streak data for user with no sessions', async () => {
      const response = await request(app)
        .get('/api/dashboard/streak')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('currentStreak');
      expect(response.body).toHaveProperty('longestStreak');
      expect(response.body).toHaveProperty('totalDays');
      expect(response.body).toHaveProperty('lastLoginDate');
      expect(response.body.currentStreak).toBe(0);
      expect(response.body.longestStreak).toBe(0);
      expect(response.body.totalDays).toBe(0);
    });

    it('should calculate streak correctly with completed sessions', async () => {
      // Create a completed timer session for today
      db.prepare(`
        INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, created_at)
        VALUES (?, 25, 'focus', 1, datetime('now'), datetime('now'))
      `).run(userId);

      const response = await request(app)
        .get('/api/dashboard/streak')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.currentStreak).toBeGreaterThanOrEqual(1);
      expect(response.body.totalDays).toBeGreaterThanOrEqual(1);
    });

    // NEW: exercise longest-streak branches (gap days)
    it('should compute longest streak correctly when there are gaps (current < longest)', async () => {
      db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);

      // Two-day chain (-3d, -2d), skip -1d, and one today
      db.prepare(`
        INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, created_at)
        VALUES (?, 25, 'focus', 1, datetime('now','-3 days'), datetime('now','-3 days'))
      `).run(userId);
      db.prepare(`
        INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, created_at)
        VALUES (?, 25, 'focus', 1, datetime('now','-2 days'), datetime('now','-2 days'))
      `).run(userId);
      db.prepare(`
        INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, created_at)
        VALUES (?, 25, 'focus', 1, datetime('now'), datetime('now'))
      `).run(userId);

      const res = await request(app)
        .get('/api/dashboard/streak')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // longest from (-3 -> -2) = 2
      expect(res.body.longestStreak).toBeGreaterThanOrEqual(2);
      // current is just today (we skipped -1d)
      expect(res.body.currentStreak).toBe(1);
    });
  });

  describe('GET /api/dashboard/today-schedule', () => {
    beforeEach(() => {
      db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId);
    });

    it('should return empty array when no sessions scheduled today', async () => {
      const response = await request(app)
        .get('/api/dashboard/today-schedule')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it("should return today's scheduled sessions", async () => {
      const today = new Date().toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO scheduled_sessions (user_id, title, start_datetime, duration_min)
        VALUES (?, 'Test Session', ?, 25)
      `).run(userId, `${today}T10:00:00Z`);

      const response = await request(app)
        .get('/api/dashboard/today-schedule')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('time');
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('duration');
    });

    // NEW: hit title/duration fallbacks (title NULL, duration_min NULL)
    it('should fall back to session_name and focus_duration when title/duration are missing', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Create a template so fallback has values
      const tmpl = db.prepare(`
        INSERT INTO sessions (user_id, name, focus_duration, break_duration)
        VALUES (?, 'Template Name', 42, 5)
      `).run(userId);

      // Schedule row with NULL title and NULL duration_min
      db.prepare(`
        INSERT INTO scheduled_sessions (user_id, session_id, title, start_datetime, duration_min)
        VALUES (?, ?, NULL, ?, NULL)
      `).run(userId, tmpl.lastInsertRowid, `${today}T09:30:00Z`);

      const res = await request(app)
        .get('/api/dashboard/today-schedule')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const item = res.body.find(x => x.title === 'Template Name');
      expect(item).toBeTruthy();
      expect(item.duration).toBe('42 min');
      expect(item).toHaveProperty('time');
    });
  });

  describe('GET /api/dashboard/stats', () => {
    beforeEach(() => {
      db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
    });

    it('should return stats with no completed sessions', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalFocusTime');
      expect(response.body).toHaveProperty('sessionsCompleted');
      expect(response.body).toHaveProperty('averageSession');
      expect(response.body.sessionsCompleted).toBe(0);
    });

    it('should calculate stats from completed sessions', async () => {
      // Add some completed sessions
      db.prepare(`
        INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, created_at)
        VALUES (?, 25, 'focus', 1, datetime('now'), datetime('now'))
      `).run(userId);

      db.prepare(`
        INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, created_at)
        VALUES (?, 30, 'focus', 1, datetime('now'), datetime('now'))
      `).run(userId);

      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.sessionsCompleted).toBeGreaterThanOrEqual(2);
    });

    // NEW: ensure sessions older than 7 days are excluded
    it('should ignore completed sessions older than 7 days', async () => {
      db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);

      db.prepare(`
        INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, created_at)
        VALUES (?, 999, 'focus', 1, datetime('now','-10 days'), datetime('now','-10 days'))
      `).run(userId);

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.sessionsCompleted).toBe(0);
      expect(res.body.totalFocusTime).toBe('0m');
    });
  });

  describe('GET /api/dashboard/overview', () => {
    it('should return complete dashboard overview', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('streak');
      expect(response.body).toHaveProperty('todaysSchedule');
      expect(response.body).toHaveProperty('templates');

      expect(response.body.streak).toHaveProperty('currentStreak');
      expect(response.body.streak).toHaveProperty('longestStreak');
      expect(response.body.streak).toHaveProperty('totalDays');
      expect(Array.isArray(response.body.todaysSchedule)).toBe(true);
      expect(Array.isArray(response.body.templates)).toBe(true);
    });

    // NEW: exercise lastLoginDate truthy branch
    it('should set streak.lastLoginDate to the most recent completed session date', async () => {
      db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);

      db.prepare(`
        INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, created_at)
        VALUES (?, 25, 'focus', 1, datetime('now'), datetime('now'))
      `).run(userId);

      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const todayIso = new Date().toISOString().split('T')[0];
      expect(res.body.streak.lastLoginDate).toBe(todayIso);
    });

    it('should include session templates in overview', async () => {
      // Create a session template
      db.prepare(`
        INSERT INTO sessions (user_id, name, focus_duration, break_duration)
        VALUES (?, 'Test Template', 25, 5)
      `).run(userId);

      const response = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.templates.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully on streak endpoint', async () => {
      const response = await request(app)
        .get('/api/dashboard/streak')
        .set('Authorization', 'Bearer invalid_token');

      expect([401, 500]).toContain(response.status);
    });
  });

  describe('Dashboard API — error logging coverage (forced DB failure)', () => {
    const Database = require('better-sqlite3');

    const forceDbError = () =>
        jest.spyOn(Database.prototype, 'prepare').mockImplementation(() => {
          throw new Error('FORCED_DB_FAILURE');
        });

    it('streak: responds 500 and logs when DB throws', async () => {
      const spy = forceDbError();
      const res = await request(app)
          .get('/api/dashboard/streak')
          .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(500);
      // optional: assert error shape
      expect(res.body).toHaveProperty('error');
      spy.mockRestore();
    });

    it("today-schedule: responds 500 and logs when DB throws", async () => {
      const spy = forceDbError();
      const res = await request(app)
          .get('/api/dashboard/today-schedule')
          .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      spy.mockRestore();
    });

    it('stats: responds 500 and logs when DB throws', async () => {
      const spy = forceDbError();
      const res = await request(app)
          .get('/api/dashboard/stats')
          .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      spy.mockRestore();
    });

    it('overview: responds 500 and logs when DB throws', async () => {
      const spy = forceDbError();
      const res = await request(app)
          .get('/api/dashboard/overview')
          .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      spy.mockRestore();
    });
  });

});
