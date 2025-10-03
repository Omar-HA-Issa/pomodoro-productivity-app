jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 'test-user-dashboard' };
    next();
  },
}));

const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

const userId = 'test-user-dashboard';
const auth = (r) => r.set('Authorization', 'Bearer test-token');

function seedTemplate({ name = 'Test Template', focus = 25, brk = 5 } = {}) {
  return db.prepare(`
    INSERT INTO sessions (user_id, name, description, focus_duration, break_duration)
    VALUES (?, ?, '', ?, ?)
  `).run(userId, name, focus, brk).lastInsertRowid;
}

function seedCompletedTimer({ minutes = 25, when = new Date() } = {}) {
  const iso = new Date(when).toISOString();
  db.prepare(`
    INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, end_time, created_at)
    VALUES (?, ?, 'focus', 1, ?, ?, ?)
  `).run(userId, minutes, iso, iso, iso);
}

function seedSchedule({ title = 'Meeting', start = new Date(), sessionId = null } = {}) {
  const iso = new Date(start).toISOString();
  db.prepare(`
    INSERT INTO scheduled_sessions (user_id, session_id, title, start_datetime)
    VALUES (?, ?, ?, ?)
  `).run(userId, sessionId, title, iso);
}

function createDate(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date;
}

describe('Dashboard API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  });

  afterAll(() => {
    db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  });

  describe('GET /api/dashboard/streak', () => {
    it('returns zero streak with no sessions', async () => {
      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        currentStreak: 0,
        longestStreak: 0,
        totalDays: 0,
      });
      expect(res.body.lastLoginDate).toBeDefined();
    });

    it('calculates streak from completed sessions (today only)', async () => {
      seedCompletedTimer({ minutes: 25 });
      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBeGreaterThanOrEqual(1);
      expect(res.body.longestStreak).toBeGreaterThanOrEqual(1);
      expect(res.body.totalDays).toBeGreaterThanOrEqual(1);
    });

    it('handles multi-day consecutive streaks', async () => {
      seedCompletedTimer({ minutes: 25, when: createDate(-1) });
      seedCompletedTimer({ minutes: 30, when: createDate(0) });

      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBeGreaterThanOrEqual(2);
    });

    it('handles non-consecutive sessions (broken streak)', async () => {
      seedCompletedTimer({ minutes: 25, when: createDate(-3) });
      seedCompletedTimer({ minutes: 30, when: createDate(0) });

      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBe(1);
      expect(res.body.totalDays).toBe(2);
    });

    it('calculates longest streak across multiple gaps', async () => {
      // 3-day streak (10-12 days ago)
      [-12, -11, -10].forEach(offset => seedCompletedTimer({ when: createDate(offset) }));
      // 2-day streak (yesterday and today)
      [-1, 0].forEach(offset => seedCompletedTimer({ when: createDate(offset) }));

      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body.longestStreak).toBeGreaterThanOrEqual(3);
    });

    it('handles single session today', async () => {
      seedCompletedTimer({ minutes: 25 });
      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.body).toMatchObject({
        currentStreak: 1,
        longestStreak: 1,
        totalDays: 1,
      });
    });
  });

  describe('GET /api/dashboard/today-schedule', () => {
    it('returns empty array with no scheduled sessions', async () => {
      const res = await auth(request(app).get('/api/dashboard/today-schedule'));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns only today\'s scheduled sessions', async () => {
      seedSchedule({ title: 'Today Meeting', start: createDate(0) });
      seedSchedule({ title: 'Tomorrow Meeting', start: createDate(1) });

      const res = await auth(request(app).get('/api/dashboard/today-schedule'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Today Meeting');
    });

    it('handles null session_id gracefully', async () => {
      seedSchedule({ title: 'No Template Meeting', sessionId: null });

      const res = await auth(request(app).get('/api/dashboard/today-schedule'));
      expect(res.body[0].title).toBe('No Template Meeting');
      expect(res.body[0].duration).toContain('min');
    });

    it('formats time strings correctly', async () => {
      const time = new Date();
      time.setHours(10, 30, 0, 0);
      seedSchedule({ title: 'Morning Meeting', start: time });

      const res = await auth(request(app).get('/api/dashboard/today-schedule'));
      expect(res.body[0].time).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('returns stats with no completed sessions', async () => {
      const res = await auth(request(app).get('/api/dashboard/stats'));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        sessionsCompleted: 0,
        totalFocusTime: '0m',
      });
    });

    it('calculates stats from completed sessions', async () => {
      seedCompletedTimer({ minutes: 25 });
      seedCompletedTimer({ minutes: 30 });

      const res = await auth(request(app).get('/api/dashboard/stats'));
      expect(res.body).toMatchObject({
        sessionsCompleted: 2,
        totalFocusTime: '55m',
      });
    });

    it('returns stats for last 7 days only', async () => {
      seedCompletedTimer({ minutes: 100, when: createDate(-10) }); // Too old
      seedCompletedTimer({ minutes: 25, when: createDate(0) });
      seedCompletedTimer({ minutes: 30, when: createDate(0) });

      const res = await auth(request(app).get('/api/dashboard/stats'));
      expect(res.body.totalFocusTime).toBe('55m');
    });

    it('calculates average session duration', async () => {
      [20, 30, 40].forEach(min => seedCompletedTimer({ minutes: min }));

      const res = await auth(request(app).get('/api/dashboard/stats'));
      expect(res.body).toMatchObject({
        sessionsCompleted: 3,
        totalFocusTime: '90m',
        averageSession: '30m',
      });
    });
  });

  describe('GET /api/dashboard/overview', () => {
    it('returns complete dashboard overview with all fields', async () => {
      const res = await auth(request(app).get('/api/dashboard/overview'));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        streak: expect.objectContaining({ currentStreak: expect.any(Number) }),
        todaysSchedule: expect.any(Array),
        templates: expect.any(Array),
      });
    });

    it('includes session templates when present', async () => {
      seedTemplate({ name: 'Deep Work', focus: 50, brk: 10 });

      const res = await auth(request(app).get('/api/dashboard/overview'));
      expect(res.body.templates.length).toBeGreaterThan(0);
    });

    it('returns overview with complete data structure', async () => {
      seedCompletedTimer({ minutes: 25 });
      seedSchedule({ title: 'Meeting' });
      seedTemplate({ name: 'Focus' });

      const res = await auth(request(app).get('/api/dashboard/overview'));

      expect(res.body.streak.currentStreak).toBeGreaterThanOrEqual(1);
      expect(res.body.todaysSchedule.length).toBeGreaterThan(0);
      expect(res.body.templates.length).toBeGreaterThan(0);
    });
  });
});