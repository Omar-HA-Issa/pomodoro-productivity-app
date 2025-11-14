const { db: defaultDb } = require('../database');

class DashboardRepository {
  constructor(db = defaultDb) {
    this.db = db;

    this.statements = {
      distinctDatesDesc: this.db.prepare(`
        SELECT DISTINCT DATE(created_at) AS session_date
        FROM timer_sessions
        WHERE user_id = ? AND completed = 1
        ORDER BY session_date DESC
      `),
      distinctDatesAsc: this.db.prepare(`
        SELECT DISTINCT DATE(created_at) AS session_date
        FROM timer_sessions
        WHERE user_id = ? AND completed = 1
        ORDER BY session_date ASC
      `),
      totalActiveDays: this.db.prepare(`
        SELECT COUNT(DISTINCT DATE(created_at)) AS total
        FROM timer_sessions
        WHERE user_id = ? AND completed = 1
      `),
      lastCompletedDate: this.db.prepare(`
        SELECT DATE(created_at) AS last_date
        FROM timer_sessions
        WHERE user_id = ? AND completed = 1
        ORDER BY created_at DESC
        LIMIT 1
      `),
      todaySchedule: this.db.prepare(`
        SELECT 
          s.id,
          s.session_id,
          s.title,
          s.start_datetime,
          s.duration_min,
          ses.name AS session_name,
          ses.focus_duration,
          ses.break_duration
        FROM scheduled_sessions s
        LEFT JOIN sessions ses ON s.session_id = ses.id
        WHERE s.user_id = ? AND DATE(s.start_datetime) = ?
        ORDER BY s.start_datetime ASC
      `),
      sevenDayStats: this.db.prepare(`
        SELECT 
          COUNT(*) AS sessions_completed,
          SUM(duration_minutes) AS total_focus_time,
          AVG(duration_minutes) AS average_session
        FROM timer_sessions
        WHERE user_id = ?
          AND completed = 1
          AND created_at >= ?
      `),
      templates: this.db.prepare(`
        SELECT id, name, focus_duration, break_duration, description
        FROM sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
      `),
    };
  }

  getDistinctDatesDesc(userId) {
    return this.statements.distinctDatesDesc.all(userId);
  }

  getDistinctDatesAsc(userId) {
    return this.statements.distinctDatesAsc.all(userId);
  }

  getTotalActiveDays(userId) {
    const row = this.statements.totalActiveDays.get(userId);
    return row ? row.total : 0;
  }

  getLastCompletedDate(userId) {
    return this.statements.lastCompletedDate.get(userId) || null;
  }

  getTodaySchedule(userId, dateString) {
    return this.statements.todaySchedule.all(userId, dateString);
  }

  getSevenDayStats(userId, fromIso) {
    return this.statements.sevenDayStats.get(userId, fromIso) || {
      sessions_completed: 0,
      total_focus_time: 0,
      average_session: 0,
    };
  }

  getTemplates(userId) {
    return this.statements.templates.all(userId) || [];
  }
}

module.exports = DashboardRepository;
