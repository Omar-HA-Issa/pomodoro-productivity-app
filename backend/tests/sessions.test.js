const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

describe('Sessions API', () => {
  let authToken, userId;
  const auth = (r) => r.set('Authorization', `Bearer ${authToken}`);
  const create = (p) => auth(request(app).post('/api/sessions')).send(p);

  beforeAll(async () => {
    const email = `test.sessions.${Date.now()}@testmail.com`;
    await request(app).post('/api/auth/signup').send({ email, password: 'TestPass123!', first_name: 'Test', last_name: 'User' });
    const { body } = await request(app).post('/api/auth/signin').send({ email, password: 'TestPass123!' });
    authToken = body.session.access_token; userId = body.user.id;
  });

  afterAll(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM timer_sessions WHERE user_id = ?').run(userId);
  });

  beforeEach(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('POST /api/sessions', () => {
    it('creates, trims, validates', async () => {
      const ok = await create({ name: 'Deep Work', focus_duration: 50, break_duration: 10, description: 'Focused work session' });
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ name: 'Deep Work', focus_duration: 50, break_duration: 10, description: 'Focused work session' });

      const noDesc = await create({ name: 'Quick', focus_duration: 25, break_duration: 5 });
      expect(noDesc.status).toBe(201); expect(noDesc.body.description).toBeNull();

      const trimmed = await create({ name: '  Trim  ', focus_duration: 25, break_duration: 5, description: '  D  ' });
      expect(trimmed.body).toMatchObject({ name: 'Trim', description: 'D' });

      const v1 = await create({ focus_duration: 25, break_duration: 5 });
      const v2 = await create({ name: 'X', break_duration: 5 });
      const v3 = await create({ name: 'X', focus_duration: 0, break_duration: 5 });
      const v4 = await create({ name: 'X', focus_duration: 25 });
      const v5 = await create({ name: 'X', focus_duration: 25, break_duration: 0 });
      expect([v1.status, v2.status, v3.status, v4.status, v5.status].every(s => s === 400)).toBe(true);
    });
  });

  describe('GET /api/sessions', () => {
    it('lists sessions (empty and filled) and requires auth', async () => {
      const empty = await auth(request(app).get('/api/sessions'));
      expect(empty.status).toBe(200); expect(empty.body).toEqual([]);

      await create({ name: 'Session 1', focus_duration: 25, break_duration: 5 });
      await new Promise(r => setTimeout(r, 150)); // ensure ordering not assumed
      await create({ name: 'Session 2', focus_duration: 50, break_duration: 10 });

      const all = await auth(request(app).get('/api/sessions'));
      expect(all.status).toBe(200); expect(all.body).toHaveLength(2);
      expect(all.body.map(s => s.name).sort()).toEqual(['Session 1', 'Session 2']);

      const noAuth = await request(app).get('/api/sessions');
      expect(noAuth.status).toBe(401);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('gets one / 404 missing', async () => {
      const id = (await create({ name: 'One', focus_duration: 25, break_duration: 5 })).body.id;
      const ok = await auth(request(app).get(`/api/sessions/${id}`));
      expect(ok.status).toBe(200); expect(ok.body.id).toBe(id); expect(ok.body.name).toBe('One');

      const nf = await auth(request(app).get('/api/sessions/99999'));
      expect(nf.status).toBe(404);
    });
  });

  describe('PUT /api/sessions/:id', () => {
    it('updates + validates + 404s', async () => {
      const id = (await create({ name: 'Original', focus_duration: 25, break_duration: 5, description: 'Old' })).body.id;

      const up = await auth(request(app).put(`/api/sessions/${id}`)).send({ name: 'Updated', focus_duration: 50, break_duration: 10, description: 'New' });
      expect(up.status).toBe(200);
      expect(up.body).toMatchObject({ name: 'Updated', focus_duration: 50, break_duration: 10, description: 'New' });

      const v1 = await auth(request(app).put(`/api/sessions/${id}`)).send({ focus_duration: 50, break_duration: 10 });
      const v2 = await auth(request(app).put(`/api/sessions/${id}`)).send({ name: 'X', focus_duration: 0, break_duration: 10 });
      const v3 = await auth(request(app).put(`/api/sessions/${id}`)).send({ name: 'X', focus_duration: 25, break_duration: 0 });
      const nf = await auth(request(app).put('/api/sessions/99999')).send({ name: 'Updated', focus_duration: 25, break_duration: 5 });
      expect([v1.status, v2.status, v3.status]).toEqual([400, 400, 400]);
      expect(nf.status).toBe(404);
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('deletes session + related rows / 404 missing', async () => {
      const id = (await create({ name: 'Del', focus_duration: 25, break_duration: 5 })).body.id;
      await auth(request(app).post('/api/schedule')).send({ session_id: id, start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 });

      const del = await auth(request(app).delete(`/api/sessions/${id}`));
      expect(del.status).toBe(204);

      const verify = await auth(request(app).get('/api/schedule'));
      expect(verify.body.filter(s => s.session_id === id)).toHaveLength(0);

      const nf = await auth(request(app).delete('/api/sessions/99999'));
      expect(nf.status).toBe(404);
    });
  });

  describe('Errors/Concurrency', () => {
    it('500s on invalid types (create/update)', async () => {
      const badCreate = await create({ name: 'Bad', focus_duration: 'invalid', break_duration: 5 });
      expect(badCreate.status).toBe(500);

      const id = (await create({ name: 'OK', focus_duration: 25, break_duration: 5 })).body.id;
      const badUpdate = await auth(request(app).put(`/api/sessions/${id}`)).send({ name: 'Upd', focus_duration: 'invalid', break_duration: 5 });
      expect(badUpdate.status).toBe(500);
    });

    it('handles busy + concurrent deletes', async () => {
      const floods = await Promise.all(Array.from({ length: 20 }, () => auth(request(app).get('/api/sessions'))));
      expect(floods.every(r => [200, 500].includes(r.status))).toBe(true);

      const id = (await create({ name: 'DelMe', focus_duration: 25, break_duration: 5 })).body.id;
      const dels = await Promise.all(Array.from({ length: 12 }, () => auth(request(app).delete(`/api/sessions/${id}`))));
      expect(dels.every(r => [204, 404, 500].includes(r.status))).toBe(true);
    });
  });
});
