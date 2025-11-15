const { db: defaultDb } = require('../database');

class SessionsRepository {
  constructor(db = defaultDb) {
    this.db = db;

    this.statements = {
      listForUser: this.db.prepare(`
        SELECT *
        FROM sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
      `),
      create: this.db.prepare(`
        INSERT INTO sessions (
          user_id,
          name,
          focus_duration,
          break_duration,
          description,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `),
      getByIdForUser: this.db.prepare(`
        SELECT *
        FROM sessions
        WHERE id = ? AND user_id = ?
      `),
      update: this.db.prepare(`
        UPDATE sessions
        SET name = ?, focus_duration = ?, break_duration = ?, description = ?
        WHERE id = ? AND user_id = ?
      `),
      deleteTimersByTemplate: this.db.prepare(`
        DELETE FROM timer_sessions
        WHERE session_template_id = ? AND user_id = ?
      `),
      deleteScheduleByTemplate: this.db.prepare(`
        DELETE FROM scheduled_sessions
        WHERE session_id = ? AND user_id = ?
      `),
      deleteSession: this.db.prepare(`
        DELETE FROM sessions
        WHERE id = ? AND user_id = ?
      `),
    };
  }

  listForUser(userId) {
    return this.statements.listForUser.all(userId);
  }

  create(userId, { name, focus_duration, break_duration, description }, createdAt) {
    const result = this.statements.create.run(
      userId,
      name,
      focus_duration,
      break_duration,
      description ?? null,
      createdAt
    );
    return result.lastInsertRowid;
  }

  getByIdForUser(id, userId) {
    return this.statements.getByIdForUser.get(id, userId);
  }

  update(id, userId, { name, focus_duration, break_duration, description }) {
    const result = this.statements.update.run(
      name,
      focus_duration,
      break_duration,
      description ?? null,
      id,
      userId
    );
    if (result.changes === 0) return null;
    return this.getByIdForUser(id, userId);
  }

  deleteWithDependents(id, userId) {
    this.statements.deleteTimersByTemplate.run(id, userId);
    this.statements.deleteScheduleByTemplate.run(id, userId);

    const result = this.statements.deleteSession.run(id, userId);
    return result.changes > 0;
  }
}

module.exports = SessionsRepository;
