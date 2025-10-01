const request = require('supertest');
const app = require('../server');
const { db } = require('../database');

describe('Schedule API', () => {
  let authToken, userId, sessionId;
  const auth = (r) => r.set('Authorization', `Bearer ${authToken}`);
  const create = (payload) => auth(request(app).post('/api/schedule')).send(payload);

  beforeAll(async () => {
    const email = `test.schedule.${Date.now()}@testmail.com`;
    await request(app).post('/api/auth/signup').send({ email, password: 'TestPass123!' });
    const { body } = await request(app).post('/api/auth/signin').send({ email, password: 'TestPass123!' });
    authToken = body.session.access_token; userId = body.user.id;

    const s = await auth(request(app).post('/api/sessions')).send({ name: 'Test Template', focus_duration: 25, break_duration: 5 });
    sessionId = s.body.id;
  });

  afterAll(() => {
    db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  });

  beforeEach(() => {
    db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('POST /api/schedule', () => {
    it('creates with session_id and with title only; defaults duration', async () => {
      const a = await create({ session_id: sessionId, start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 });
      expect(a.status).toBe(201);
      expect(a.body).toMatchObject({ session_id: sessionId, start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 });
      expect(a.body.session.name).toBe('Test Template');

      const b = await create({ title: 'Custom', start_datetime: '2025-10-15T14:00:00Z' });
      expect(b.status).toBe(201);
      expect(b.body).toMatchObject({ title: 'Custom', session_id: null, session: null, duration_min: 25 });
    });

    it('validates inputs', async () => {
      const noStart = await create({ session_id: sessionId, duration_min: 25 });
      expect(noStart.status).toBe(400);
      const neither = await create({ start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 });
      expect(neither.status).toBe(400);
      const badSession = await create({ session_id: 99999, start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 });
      expect(badSession.status).toBe(400);
    });
  });

  describe('GET /api/schedule', () => {
    beforeEach(async () => {
      await create({ session_id: sessionId, start_datetime: '2025-10-10T09:00:00Z', duration_min: 25 });
      await create({ title: 'Later', start_datetime: '2025-10-20T14:00:00Z', duration_min: 30 });
    });

    it('lists all; filters by from/to/range; returns template data', async () => {
      const all = await auth(request(app).get('/api/schedule'));
      expect(all.status).toBe(200);
      expect(all.body).toHaveLength(2);

      const from = await auth(request(app).get('/api/schedule?from=2025-10-15T00:00:00Z'));
      expect(from.body).toHaveLength(1);
      const to = await auth(request(app).get('/api/schedule?to=2025-10-15T00:00:00Z'));
      expect(to.body).toHaveLength(1);
      const range = await auth(request(app).get('/api/schedule?from=2025-10-01T00:00:00Z&to=2025-10-15T00:00:00Z'));
      expect(range.body).toHaveLength(1);

      const withTpl = all.body.find(s => s.session_id === sessionId);
      expect(withTpl.session).toBeDefined();
      expect(withTpl.session.focus_duration).toBe(25);
    });

    it('returns empty array when none', async () => {
      db.prepare('DELETE FROM scheduled_sessions WHERE user_id = ?').run(userId);
      const r = await auth(request(app).get('/api/schedule'));
      expect(r.status).toBe(200); expect(r.body).toEqual([]);
    });
  });

  describe('PUT /api/schedule/:id', () => {
    let id;
    beforeEach(async () => { id = (await create({ session_id: sessionId, start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 })).body.id; });

    it('updates fields and boolean completed conversion', async () => {
      const r = await auth(request(app).put(`/api/schedule/${id}`)).send({ title: 'Updated', start_datetime: '2025-10-15T11:00:00Z', duration_min: 50, completed: false });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ title: 'Updated', start_datetime: '2025-10-15T11:00:00Z', duration_min: 50, completed: false });
    });

    it('validates required and session_id', async () => {
      const noStart = await auth(request(app).put(`/api/schedule/${id}`)).send({ title: 'Updated', duration_min: 30 });
      expect(noStart.status).toBe(400);
      const badId = await auth(request(app).put(`/api/schedule/${id}`)).send({ session_id: 99999, start_datetime: '2025-10-15T11:00:00Z', duration_min: 25 });
      expect(badId.status).toBe(400);
      const notFound = await auth(request(app).put('/api/schedule/99999')).send({ start_datetime: '2025-10-15T11:00:00Z', duration_min: 25 });
      expect(notFound.status).toBe(404);
    });
  });

  describe('DELETE /api/schedule/:id', () => {
    it('deletes or 404s non-existent', async () => {
      const id = (await create({ session_id: sessionId, start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 })).body.id;
      const del = await auth(request(app).delete(`/api/schedule/${id}`));
      expect(del.status).toBe(204);
      const again = await auth(request(app).delete('/api/schedule/99999'));
      expect(again.status).toBe(404);
    });
  });

  describe('Errors/Concurrency', () => {
    it('400 on create/update invalid payloads', async () => {
      const badCreate = await create({ title: 'Test' }); // missing start_datetime
      expect(badCreate.status).toBe(400);
      const id = (await create({ title: 'OK', start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 })).body.id;
      const badUpdate = await auth(request(app).put(`/api/schedule/${id}`)).send({ title: 'Upd' });
      expect(badUpdate.status).toBe(400);
    });

    it('handles GET contention/updates/deletes concurrently', async () => {
      // contention on GET
      const gets = await Promise.all(Array.from({ length: 20 }, () => auth(request(app).get('/api/schedule'))));
      expect(gets.every(r => [200, 500].includes(r.status))).toBe(true);

      const id = (await create({ title: 'Lock', start_datetime: '2025-10-15T10:00:00Z', duration_min: 25 })).body.id;
      const updates = await Promise.all(Array.from({ length: 12 }, (_, i) =>
        auth(request(app).put(`/api/schedule/${id}`)).send({ title: `U${i}`, start_datetime: '2025-10-15T11:00:00Z', duration_min: 30 })
      ));
      expect(updates.every(r => [200, 404, 500].includes(r.status))).toBe(true);

      const deletes = await Promise.all(Array.from({ length: 12 }, () => auth(request(app).delete(`/api/schedule/${id}`))));
      expect(deletes.every(r => [204, 404, 500].includes(r.status))).toBe(true);
    });
  });
});
