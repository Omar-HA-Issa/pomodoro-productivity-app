const { db: defaultDb } = require('../database');

class InsightsRepository {
  constructor(db = defaultDb) {
    this.db = db;

    this.statements = {
      completedRuns: this.db.prepare(`
        WITH grouped AS (
          SELECT
            ts.session_group_id,
            MIN(ts.id) AS rep_id,
            MAX(COALESCE(ts.end_time, ts.start_time, ts.created_at)) AS rep_date,
            SUM(CASE WHEN ts.phase = 'focus' THEN ts.duration_minutes ELSE 0 END) AS total_focus_min,
            SUM(CASE WHEN ts.phase = 'focus' THEN 1 ELSE 0 END) AS focus_blocks,
            MAX(ts.target_cycles) AS target_cycles,
            MAX(ts.analyzed_at) AS analyzed_at,
            (SELECT t2.sentiment_label
               FROM timer_sessions t2
              WHERE t2.user_id = ts.user_id
                AND t2.session_group_id = ts.session_group_id
                AND t2.sentiment_label IS NOT NULL
              ORDER BY t2.analyzed_at DESC
              LIMIT 1) AS sentiment_label,
            (SELECT t2.sentiment_score
               FROM timer_sessions t2
              WHERE t2.user_id = ts.user_id
                AND t2.session_group_id = ts.session_group_id
                AND t2.sentiment_label IS NOT NULL
              ORDER BY t2.analyzed_at DESC
              LIMIT 1) AS sentiment_score,
            MAX(ts.session_template_id) AS session_template_id
          FROM timer_sessions ts
          WHERE ts.user_id = ?
            AND ts.completed = 1
            AND ts.session_group_id IS NOT NULL
          GROUP BY ts.session_group_id
          HAVING focus_blocks >= target_cycles
        ),
        legacy AS (
          -- No group id? Treat each completed focus row as its own "run".
          SELECT
            NULL AS session_group_id,
            ts.id AS rep_id,
            COALESCE(ts.end_time, ts.start_time, ts.created_at) AS rep_date,
            ts.duration_minutes AS total_focus_min,
            1 AS focus_blocks,
            ts.target_cycles AS target_cycles,
            ts.analyzed_at AS analyzed_at,
            ts.sentiment_label AS sentiment_label,
            ts.sentiment_score AS sentiment_score,
            ts.session_template_id AS session_template_id
          FROM timer_sessions ts
          WHERE ts.user_id = ?
            AND ts.completed = 1
            AND ts.session_group_id IS NULL
            AND ts.phase = 'focus'
        )
        SELECT * FROM grouped
        UNION ALL
        SELECT * FROM legacy
        ORDER BY rep_date DESC
        LIMIT 300;
      `),
      sessionTemplateName: this.db.prepare(`
        SELECT name
        FROM sessions
        WHERE id = ?
      `),
      timerSessionForUser: this.db.prepare(`
        SELECT *
        FROM timer_sessions
        WHERE id = ? AND user_id = ?
      `),
      updateSentiment: this.db.prepare(`
        UPDATE timer_sessions
        SET analyzed_at = ?,
            sentiment_label = ?,
            sentiment_score = ?
        WHERE id = ? AND user_id = ?
      `),
      repIdForGroup: this.db.prepare(`
        SELECT MIN(id) AS rep_id
        FROM timer_sessions
        WHERE user_id = ? AND session_group_id = ?
      `),
    };
  }

  getCompletedRuns(userId) {
    return this.statements.completedRuns.all(userId, userId);
  }

  getTemplateNameById(templateId) {
    if (!templateId) return null;
    const row = this.statements.sessionTemplateName.get(templateId);
    return row ? row.name : null;
  }

  findTimerSessionForUser(id, userId) {
    return this.statements.timerSessionForUser.get(id, userId) || null;
  }

  updateTimerSentiment(id, userId, timestamp, label, score) {
    this.statements.updateSentiment.run(
      timestamp,
      label,
      score,
      id,
      userId
    );
  }

  getRepresentativeIdForGroup(userId, groupId) {
    if (!groupId) return null;
    const row = this.statements.repIdForGroup.get(userId, groupId);
    return row ? row.rep_id : null;
  }
}

module.exports = InsightsRepository;
