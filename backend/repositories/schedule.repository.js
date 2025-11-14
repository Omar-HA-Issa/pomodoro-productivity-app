const { db: defaultDb } = require('../database');

class ScheduleRepository {
  constructor(db = defaultDb) {
    this.db = db;

    this.statements = {
      listBase: this.db.prepare(`
        SELECT
          ss.*,
          s.name AS session_name,
          s.focus_duration,
          s.break_duration,
          s.description AS session_description
        FROM scheduled_sessions ss
        LEFT JOIN sessions s ON ss.session_id = s.id
        WHERE ss.user_id = ?
      `),
      listWithFrom: this.db.prepare(`
        SELECT
          ss.*,
          s.name AS session_name,
          s.focus_duration,
          s.break_duration,
          s.description AS session_description
        FROM scheduled_sessions ss
        LEFT JOIN sessions s ON ss.session_id = s.id
        WHERE ss.user_id = ?
          AND ss.start_datetime >= ?
      `),
      listWithTo: this.db.prepare(`
        SELECT
          ss.*,
          s.name AS session_name,
          s.focus_duration,
          s.break_duration,
          s.description AS session_description
        FROM scheduled_sessions ss
        LEFT JOIN sessions s ON ss.session_id = s.id
        WHERE ss.user_id = ?
          AND ss.start_datetime <= ?
      `),
      listWithFromTo: this.db.prepare(`
        SELECT
          ss.*,
          s.name AS session_name,
          s.focus_duration,
          s.break_duration,
          s.description AS session_description
        FROM scheduled_sessions ss
        LEFT JOIN sessions s ON ss.session_id = s.id
        WHERE ss.user_id = ?
          AND ss.start_datetime >= ?
          AND ss.start_datetime <= ?
      `),
      insert: this.db.prepare(`
        INSERT INTO scheduled_sessions (
          user_id,
          session_id,
          title,
          start_datetime,
          duration_min,
          completed
        ) VALUES (?, ?, ?, ?, ?, 0)
      `),
      getByIdForUser: this.db.prepare(`
        SELECT
          ss.*,
          s.name AS session_name,
          s.focus_duration,
          s.break_duration,
          s.description AS session_description
        FROM scheduled_sessions ss
        LEFT JOIN sessions s ON ss.session_id = s.id
        WHERE ss.id = ? AND ss.user_id = ?
      `),
      update: this.db.prepare(`
        UPDATE scheduled_sessions
        SET session_id = ?, title = ?, start_datetime = ?, duration_min = ?, completed = ?
        WHERE id = ? AND user_id = ?
      `),
      delete: this.db.prepare(`
        DELETE FROM scheduled_sessions
        WHERE id = ? AND user_id = ?
      `),
      sessionOwnershipCheck: this.db.prepare(`
        SELECT id
        FROM sessions
        WHERE id = ? AND user_id = ?
      `),
    };
  }

  listForUser(userId, { from, to }) {
    let rows;
    if (from && to) {
      rows = this.statements.listWithFromTo.all(userId, from, to);
    } else if (from) {
      rows = this.statements.listWithFrom.all(userId, from);
    } else if (to) {
      rows = this.statements.listWithTo.all(userId, to);
    } else {
      rows = this.statements.listBase.all(userId);
    }

    return rows || [];
  }

  create(userId, { session_id, title, start_datetime, duration_min }) {
    const result = this.statements.insert.run(
      userId,
      session_id ?? null,
      title ?? null,
      start_datetime,
      duration_min,
    );
    const id = result.lastInsertRowid;
    return this.getByIdForUser(id, userId);
  }

  getByIdForUser(id, userId) {
    return this.statements.getByIdForUser.get(id, userId);
  }

  update(id, userId, { session_id, title, start_datetime, duration_min, completed }) {
    const result = this.statements.update.run(
      session_id ?? null,
      title ?? null,
      start_datetime,
      duration_min,
      completed ? 1 : 0,
      id,
      userId
    );
    if (result.changes === 0) return null;
    return this.getByIdForUser(id, userId);
  }

  delete(id, userId) {
    const result = this.statements.delete.run(id, userId);
    return result.changes > 0;
  }

  sessionBelongsToUser(sessionId, userId) {
    if (!sessionId) return false;
    const row = this.statements.sessionOwnershipCheck.get(sessionId, userId);
    return !!row;
  }
}

module.exports = ScheduleRepository;
