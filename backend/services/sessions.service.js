const SessionRepository = require('../repositories/sessions.repository');

class SessionServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class SessionsService {
  constructor(repository = new SessionRepository(), clock = () => new Date()) {
    this.repository = repository;
    this.clock = clock;
  }

  listSessions(userId) {
    return this.repository.listForUser(userId) || [];
  }

  createSession(userId, payload = {}) {
    const data = this.#validatePayload(payload);

    const createdAt = this.clock().toISOString();
    const id = this.repository.create(userId, data, createdAt);
    return this.repository.getByIdForUser(id, userId);
  }

  getSession(userId, id) {
    const session = this.repository.getByIdForUser(id, userId);
    if (!session) {
      throw new SessionServiceError('Session not found', 404);
    }
    return session;
  }

  updateSession(userId, id, payload = {}) {
    const data = this.#validatePayload(payload);

    const updated = this.repository.update(id, userId, data);
    if (!updated) {
      throw new SessionServiceError('Session not found', 404);
    }
    return updated;
  }

  deleteSession(userId, id) {
    const deleted = this.repository.deleteWithDependents(id, userId);
    if (!deleted) {
      throw new SessionServiceError('Session not found', 404);
    }
  }

  // ---------- private helpers ----------

  #validatePayload({ name, focus_duration, break_duration, description }) {
    if (!name || typeof name !== 'string') {
      throw new SessionServiceError('Name is required', 400);
    }

    const focus = Number(focus_duration);
    const brk = Number(break_duration);

    if (!Number.isFinite(focus) || focus < 1) {
      throw new SessionServiceError('Focus duration must be at least 1 minute', 400);
    }
    if (!Number.isFinite(brk) || brk < 1) {
      throw new SessionServiceError('Break duration must be at least 1 minute', 400);
    }

    return {
      name: name.trim(),
      focus_duration: focus,
      break_duration: brk,
      description: description ?? null,
    };
  }
}

module.exports = SessionsService;
