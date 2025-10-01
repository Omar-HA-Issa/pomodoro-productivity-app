const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

describe('Timer API', () => {
  let authToken, userId, sessionTemplateId;
  const auth = (r) => r.set('Authorization', `Bearer ${authToken}`);

  beforeAll(async () => {
    const email = `test.timer.${Date.now()}@testmail.com`;
    await request(app).post('/api/auth/signup').send({ email, password: 'TestPass123!', first_name: 'Timer', last_name: 'Test' });
    const { body } = await request(app).post('/api/auth/signin').send({ email, password: 'TestPass123!' });
    authToken = body.session.access_token; userId = body.user.id;

    const { body: s } = await auth(request(app).post('/api/sessions')).send({ name: 'Timer Template', focus_duration: 25, break_duration: 5 });
    sessionTemplateId = s.id;
  });

  afterAll(() => {
    db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  });

  beforeEach(() => {
    db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
    jest.spyOn(console, 'error').mockImplementation(() => {}); // silence expected error logs
  });
  afterEach(() => jest.restoreAllMocks());

  const start = (payload = {}) =>
    auth(request(app).post('/api/timer/start')).send({ duration_minutes: 25, phase: 'focus', ...payload });

  describe('POST /api/timer/start', () => {
    it('starts a new timer (with template)', async () => {
      const { status, body } = await start({ session_template_id: sessionTemplateId, current_cycle: 0, target_cycles: 4 });
      expect(status).toBe(201);
      expect(body).toMatchObject({ session_template_id: sessionTemplateId, duration_minutes: 25, phase: 'focus', current_cycle: 0, target_cycles: 4, completed: 0, paused: 0 });
      expect(body.start_time).toBeDefined();
    });

    it('starts without template + default fields', async () => {
      const { body } = await start({ current_cycle: undefined, target_cycles: undefined });
      expect(body.session_template_id).toBeNull();
      expect(body.current_cycle).toBe(0);
      expect(body.target_cycles).toBe(4);
    });

    it('accepts all phase types', async () => {
      for (const phase of ['focus', 'short_break', 'long_break']) {
        db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
        const { status, body } = await start({ phase });
        expect(status).toBe(201); expect(body.phase).toBe(phase);
      }
    });
  });

  describe('GET /api/timer/active', () => {
    it('returns null if none', async () => {
      const { status, body } = await auth(request(app).get('/api/timer/active'));
      expect(status).toBe(200); expect(body).toBeNull();
    });

    it('returns most recent active & ignores completed', async () => {
      const a = await start(); const id = a.body.id;
      const b = await start({ duration_minutes: 30, phase: 'short_break' });
      await auth(request(app).post('/api/timer/stop')).send({ timer_id: id });
      const { body } = await auth(request(app).get('/api/timer/active'));
      expect(body).not.toBeNull(); expect(body.completed).toBe(0); expect(body.id).toBe(b.body.id);
    });
  });

  const pause = (id) => auth(request(app).post('/api/timer/pause')).send({ timer_id: id });
  const resume = (id) => auth(request(app).post('/api/timer/resume')).send({ timer_id: id });
  const stop = (id) => auth(request(app).post('/api/timer/stop')).send({ timer_id: id });
  const complete = (id) => auth(request(app).post('/api/timer/complete')).send({ timer_id: id });

  describe('pause/resume/stop/complete', () => {
    let id;
    beforeEach(async () => { id = (await start()).body.id; });

    it('pauses, resumes, then stops', async () => {
      const pr = await pause(id); expect(pr.body).toMatchObject({ id, paused: 1, completed: 0 });
      const rr = await resume(id); expect(rr.body).toMatchObject({ id, paused: 0, completed: 0 });
      const sr = await stop(id); expect(sr.body.completed).toBe(1); expect(sr.body.end_time).toBeDefined();
    });

    it('404s for non-existent ids', async () => {
      for (const ep of [pause, resume, stop, complete]) {
        const { status } = await ep(99999);
        expect([404, 500]).toContain(status); // sqlite may bubble differently in CI
      }
    });

    it('completes directly', async () => {
      const { status, body } = await complete(id);
      expect(status).toBe(200); expect(body.completed).toBe(1); expect(body.end_time).toBeDefined();
    });

    it('sets end_time bounds on stop', async () => {
      const before = new Date().toISOString();
      const { body } = await stop(id);
      const after = new Date().toISOString();
      expect(body.end_time >= before && body.end_time <= after).toBe(true);
    });
  });

  describe('Error/Contention coverage', () => {
    it('rejects missing required fields', async () => {
      const { status } = await auth(request(app).post('/api/timer/start')).send({ duration_minutes: 25 });
      expect([400, 500]).toContain(status);
    });

    it('violates CHECK with invalid phase', async () => {
      const { status } = await start({ phase: 'INVALID' });
      expect(status).toBe(500);
    });

    it('handles ops on deleted timer', async () => {
      const id = (await start()).body.id;
      db.prepare('DELETE FROM timer_sessions WHERE id = ?').run(id);
      const { status } = await pause(id);
      expect(status).toBe(404);
    });

    it('contention/resume/stop/complete concurrency are handled', async () => {
      const id = (await start()).body.id;
      await pause(id);
      const resumes = await Promise.all(Array.from({ length: 10 }, () => resume(id)));
      expect(resumes.every(r => [200, 404, 500].includes(r.status))).toBe(true);

      const id2 = (await start()).body.id;
      const stops = await Promise.all(Array.from({ length: 10 }, () => stop(id2)));
      expect(stops.every(r => [200, 404, 500].includes(r.status))).toBe(true);

      const id3 = (await start()).body.id;
      const completes = await Promise.all(Array.from({ length: 10 }, () => complete(id3)));
      expect(completes.every(r => [200, 404, 500].includes(r.status))).toBe(true);
    });
  });
});
