const { db: defaultDb } = require('../database');

class TimerRepository {
  /**
   * @param {import('better-sqlite3')} db
   */
  constructor(db = defaultDb) {
    this.db = db;

    this.statements = {
      findActiveSession: this.db.prepare(`
        SELECT * FROM timer_sessions
        WHERE user_id = ? AND completed = 0
        ORDER BY created_at DESC
        LIMIT 1
      `),
      insertSession: this.db.prepare(`
        INSERT INTO timer_sessions (
          user_id,
          session_template_id,
          duration_minutes,
          phase,
          current_cycle,
          target_cycles,
          completed,
          paused,
          start_time,
          created_at,
          session_group_id
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
      `),
      findById: this.db.prepare(
        'SELECT * FROM timer_sessions WHERE id = ?'
      ),
      findByIdForUser: this.db.prepare(
        'SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?'
      ),
      updatePaused: this.db.prepare(
        'UPDATE timer_sessions SET paused = ? WHERE id = ? AND user_id = ?'
      ),
      markCompleted: this.db.prepare(`
        UPDATE timer_sessions
        SET completed = 1, paused = 0, end_time = ?
        WHERE id = ? AND user_id = ?
      `),
      updateNotes: this.db.prepare(
        'UPDATE timer_sessions SET notes = ? WHERE id = ? AND user_id = ?'
      ),
      fetchHistory: this.db.prepare(`
        SELECT * FROM timer_sessions
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `),
    };
  }

  getActiveSession(userId) {
    return this.statements.findActiveSession.get(userId);
  }

  createSession(sessionData) {
    const {
      user_id,
      session_template_id,
      duration_minutes,
      phase,
      current_cycle,
      target_cycles,
      start_time,
      created_at,
      session_group_id,
    } = sessionData;

    const result = this.statements.insertSession.run(
      user_id,
      session_template_id,
      duration_minutes,
      phase,
      current_cycle,
      target_cycles,
      start_time,
      created_at,
      session_group_id
    );

    return result.lastInsertRowid;
  }

  getSessionById(id) {
    return this.statements.findById.get(id);
  }

  getSessionByIdForUser(id, userId) {
    return this.statements.findByIdForUser.get(id, userId);
  }

  updatePausedStatus(id, userId, paused) {
    this.statements.updatePaused.run(paused ? 1 : 0, id, userId);
    return this.getSessionByIdForUser(id, userId);
  }

  completeSession(id, userId, endTime) {
    this.statements.markCompleted.run(endTime, id, userId);
    return this.getSessionByIdForUser(id, userId);
  }

  updateSessionNotes(id, userId, notes) {
    this.statements.updateNotes.run(notes, id, userId);
    return this.getSessionByIdForUser(id, userId);
  }

  getHistory(userId, limit) {
    return this.statements.fetchHistory.all(userId, limit);
  }
}

module.exports = TimerRepository;
