const ScheduleRepository = require('../repositories/schedule.repository');

class ScheduleServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class ScheduleService {
  constructor(repository = new ScheduleRepository()) {
    this.repository = repository;
  }

  list(userId, query = {}) {
    const { from, to } = query;
    const rows = this.repository.listForUser(userId, { from, to });
    return rows.map(this.#mapRow);
  }

  create(userId, payload = {}) {
    const data = this.#validatePayload(payload, { allowNullTitle: false });

    if (data.session_id && !this.repository.sessionBelongsToUser(data.session_id, userId)) {
      throw new ScheduleServiceError('Invalid session_id', 400);
    }

    const created = this.repository.create(userId, data);
    return this.#mapRow(created);
  }

  update(userId, id, payload = {}) {
    const data = this.#validatePayload(payload, { allowNullTitle: true });

    if (data.session_id && !this.repository.sessionBelongsToUser(data.session_id, userId)) {
      throw new ScheduleServiceError('Invalid session_id', 400);
    }

    const updated = this.repository.update(id, userId, data);
    if (!updated) {
      throw new ScheduleServiceError('Scheduled session not found', 404);
    }

    return this.#mapRow(updated);
  }

  delete(userId, id) {
    const deleted = this.repository.delete(id, userId);
    if (!deleted) {
      throw new ScheduleServiceError('Scheduled session not found', 404);
    }
  }

  // private helpers

  #validatePayload(
    { session_id = null, title = null, start_datetime, duration_min = 25, completed = false } = {},
    { allowNullTitle }
  ) {
    if (!start_datetime) {
      throw new ScheduleServiceError('start_datetime is required', 400);
    }

    if (!session_id && !title && !allowNullTitle) {
      throw new ScheduleServiceError('provide session_id or title', 400);
    }

    const duration = Number(duration_min);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new ScheduleServiceError('duration_min must be > 0', 400);
    }

    return {
      session_id,
      title,
      start_datetime,
      duration_min: duration,
      completed: Boolean(completed),
    };
  }

  #mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      session_id: row.session_id,
      title: row.title,
      start_datetime: row.start_datetime,
      duration_min: row.duration_min,
      completed: Boolean(row.completed),
      session: row.session_id
        ? {
            id: row.session_id,
            name: row.session_name,
            focus_duration: row.focus_duration,
            break_duration: row.break_duration,
            description: row.session_description,
          }
        : null,
    };
  }
}

module.exports = ScheduleService;
