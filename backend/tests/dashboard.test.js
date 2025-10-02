// Mock auth BEFORE requiring anything
jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 'test-user-dashboard' }; // Unique ID
    next();
  },
}));

const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

const userId = 'test-user-dashboard'; // Unique ID for dashboard tests
const auth = (r) => r.set('Authorization', 'Bearer test-token');

function seedTemplate({ name = 'Test Template', focus = 25, brk = 5 } = {}) {
  const info = db.prepare(`
    INSERT INTO sessions (user_id, name, description, focus_duration, break_duration)
    VALUES (?, ?, '', ?, ?)
  `).run(userId, name, focus, brk);
  return info.lastInsertRowid;
}

function seedCompletedTimer({ minutes = 25, when = new Date(), notes = null } = {}) {
  const iso = new Date(when).toISOString();
  db.prepare(`
    INSERT INTO timer_sessions (user_id, duration_minutes, phase, completed, start_time, end_time, created_at, notes)
    VALUES (?, ?, 'focus', 1, ?, ?, ?, ?)
  `).run(userId, minutes, iso, iso, iso, notes);
}

function seedSchedule({ title = 'Meeting', start = new Date(), sessionId = null } = {}) {
  const iso = new Date(start).toISOString();
  db.prepare(`
    INSERT INTO scheduled_sessions (user_id, session_id, title, start_datetime)
    VALUES (?, ?, ?, ?)
  `).run(userId, sessionId, title, iso);
}

describe('Dashboard API', () => {
  beforeEach(() => {
    // Clean children first
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
      expect(res.body).toHaveProperty('currentStreak', 0);
      expect(res.body).toHaveProperty('longestStreak', 0);
      expect(res.body).toHaveProperty('totalDays', 0);
    });

    it('calculates streak from completed sessions (today only)', async () => {
      seedCompletedTimer({ minutes: 25 });
      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBeGreaterThanOrEqual(1);
      expect(res.body.longestStreak).toBeGreaterThanOrEqual(1);
      expect(res.body.totalDays).toBeGreaterThanOrEqual(1);
    });

    it('handles multi-day consecutive streaks (yesterday + today)', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      seedCompletedTimer({ minutes: 25, when: yesterday });
      seedCompletedTimer({ minutes: 30, when: today });

      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/dashboard/today-schedule', () => {
    it('returns empty array with no scheduled sessions', async () => {
      const res = await auth(request(app).get('/api/dashboard/today-schedule'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('returns today\'s scheduled sessions', async () => {
      const today = new Date();
      seedSchedule({title: 'Today Meeting', start: today});

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      seedSchedule({title: 'Tomorrow Meeting', start: tomorrow});

      const res = await auth(request(app).get('/api/dashboard/today-schedule'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Today Meeting');
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('returns stats with no completed sessions', async () => {
      const res = await auth(request(app).get('/api/dashboard/stats'));
      expect(res.status).toBe(200);
      expect(res.body.sessionsCompleted).toBe(0);
      expect(res.body.totalFocusTime).toBe('0m');
    });

    it('calculates stats from completed sessions', async () => {
      seedCompletedTimer({minutes: 25});
      seedCompletedTimer({minutes: 30});
      const res = await auth(request(app).get('/api/dashboard/stats'));
      expect(res.status).toBe(200);
      expect(res.body.sessionsCompleted).toBe(2);
      expect(res.body.totalFocusTime).toBe('55m');
    });
  });

  describe('GET /api/dashboard/overview', () => {
    it('returns complete dashboard overview', async () => {
      const res = await auth(request(app).get('/api/dashboard/overview'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('streak');
      expect(res.body).toHaveProperty('todaysSchedule');
      expect(res.body).toHaveProperty('templates');
      expect(res.body.streak).toHaveProperty('currentStreak');
      expect(Array.isArray(res.body.todaysSchedule)).toBe(true);
      expect(Array.isArray(res.body.templates)).toBe(true);
    });

    it('includes session templates when present', async () => {
      seedTemplate({name: 'Template X', focus: 20, brk: 5});

      const res = await auth(request(app).get('/api/dashboard/overview'));
      expect(res.status).toBe(200);
      expect(res.body.templates.length).toBeGreaterThan(0);
    });
  });

  describe('Dashboard API - Additional Coverage', () => {
    it('handles streak with sessions on non-consecutive days', async () => {
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      seedCompletedTimer({minutes: 25, when: threeDaysAgo});
      seedCompletedTimer({minutes: 30, when: today});

      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBe(1); // Broken streak
      expect(res.body.totalDays).toBe(2);
    });

    it('calculates longest streak across multiple gaps', async () => {
      const dates = [];
      const today = new Date();

      // Create 3-day streak
      for (let i = 2; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i - 10);
        dates.push(date);
      }

      // Gap of 5 days

      // Create 2-day streak
      for (let i = 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(date);
      }

      dates.forEach(date => seedCompletedTimer({minutes: 25, when: date}));

      const res = await auth(request(app).get('/api/dashboard/streak'));
      expect(res.status).toBe(200);
      expect(res.body.longestStreak).toBeGreaterThanOrEqual(2);
    });

    it('returns stats for last 7 days only', async () => {
      const today = new Date();
      const tenDaysAgo = new Date(today);
      tenDaysAgo.setDate(today.getDate() - 10);

      // This should not be counted (older than 7 days)
      seedCompletedTimer({minutes: 100, when: tenDaysAgo});

      // These should be counted
      seedCompletedTimer({minutes: 25, when: today});
      seedCompletedTimer({minutes: 30, when: today});

      const res = await auth(request(app).get('/api/dashboard/stats'));
      expect(res.status).toBe(200);
      expect(res.body.totalFocusTime).toBe('55m'); // Only recent sessions
    });
  });

  it('handles empty date string for lastLoginDate', async () => {
    // No sessions, should return today as lastLoginDate
    const res = await auth(request(app).get('/api/dashboard/streak'));
    expect(res.status).toBe(200);
    expect(res.body.lastLoginDate).toBeDefined();
  });

  it('returns overview with no templates', async () => {
    // Don't seed any templates
    const res = await auth(request(app).get('/api/dashboard/overview'));
    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual([]);
  });

  it('formats today schedule with null session_id', async () => {
    const today = new Date();
    seedSchedule({title: 'No Template Meeting', start: today, sessionId: null});

    const res = await auth(request(app).get('/api/dashboard/today-schedule'));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('No Template Meeting');
  });
  it('handles streak calculation with various date formats', async () => {
    // Seed sessions with different time zones and formats
    const now = new Date();
    seedCompletedTimer({minutes: 25, when: now});

    const res = await auth(request(app).get('/api/dashboard/streak'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentStreak');
    expect(res.body).toHaveProperty('longestStreak');
    expect(res.body).toHaveProperty('totalDays');
    expect(res.body).toHaveProperty('lastLoginDate');
  });

  it('returns schedule with null template fields gracefully', async () => {
    const today = new Date();
    seedSchedule({
      title: 'Meeting without template',
      start: today,
      sessionId: null
    });

    const res = await auth(request(app).get('/api/dashboard/today-schedule'));
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Meeting without template');
    expect(res.body[0].duration).toContain('min');
  });

  it('calculates stats with only recent sessions', async () => {
    const today = new Date();
    seedCompletedTimer({minutes: 20, when: today});
    seedCompletedTimer({minutes: 25, when: today});
    seedCompletedTimer({minutes: 30, when: today});

    const res = await auth(request(app).get('/api/dashboard/stats'));
    expect(res.status).toBe(200);
    expect(res.body.sessionsCompleted).toBe(3);
    expect(res.body.totalFocusTime).toBe('75m');
    expect(res.body.averageSession).toContain('m');
  });

  it('returns overview with complete data structure', async () => {
    const today = new Date();
    seedCompletedTimer({minutes: 25, when: today});
    seedSchedule({title: 'Today Meeting', start: today});
    seedTemplate({name: 'Deep Work', focus: 50, brk: 10});

    const res = await auth(request(app).get('/api/dashboard/overview'));
    expect(res.status).toBe(200);

    // Verify all fields are present
    expect(res.body.streak).toBeDefined();
    expect(res.body.streak.currentStreak).toBeGreaterThanOrEqual(1);
    expect(res.body.streak.longestStreak).toBeGreaterThanOrEqual(1);
    expect(res.body.streak.totalDays).toBeGreaterThanOrEqual(1);
    expect(res.body.streak.lastLoginDate).toBeDefined();

    expect(res.body.todaysSchedule).toBeDefined();
    expect(Array.isArray(res.body.todaysSchedule)).toBe(true);
    expect(res.body.todaysSchedule.length).toBeGreaterThan(0);

    expect(res.body.templates).toBeDefined();
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.length).toBeGreaterThan(0);
  });

  it('handles streak with single session today', async () => {
    const today = new Date();
    seedCompletedTimer({minutes: 25, when: today});

    const res = await auth(request(app).get('/api/dashboard/streak'));
    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(1);
    expect(res.body.longestStreak).toBe(1);
    expect(res.body.totalDays).toBe(1);
  });

  it('returns formatted time strings correctly', async () => {
    const today = new Date();
    const hour10 = new Date(today);
    hour10.setHours(10, 30, 0, 0);

    seedSchedule({title: 'Morning Meeting', start: hour10});

    const res = await auth(request(app).get('/api/dashboard/today-schedule'));
    expect(res.status).toBe(200);
    expect(res.body[0].time).toMatch(/\d{2}:\d{2}/); // Format: HH:MM
  });

  it('calculates average session duration correctly', async () => {
    const today = new Date();
    seedCompletedTimer({minutes: 20, when: today});
    seedCompletedTimer({minutes: 30, when: today});
    seedCompletedTimer({minutes: 40, when: today});

    const res = await auth(request(app).get('/api/dashboard/stats'));
    expect(res.status).toBe(200);
    expect(res.body.averageSession).toBe('30m'); // (20+30+40)/3 = 30
  });
});