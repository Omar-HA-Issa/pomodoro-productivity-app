const InsightsRepository = require('../repositories/insights.repository');

class InsightsServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class InsightsService {
  constructor(repository = new InsightsRepository(), clock = () => new Date()) {
    this.repository = repository;
    this.clock = clock;
  }

  listCompletedSessions(userId) {
    const rows = this.repository.getCompletedRuns(userId);

    return rows.map((r) => {
      let title = 'Focus Session';
      if (r.session_template_id) {
        const name = this.repository.getTemplateNameById(r.session_template_id);
        if (name) title = name;
      }

      return {
        id: `timer_${r.rep_id}`,
        title,
        date: r.rep_date,
        duration: r.total_focus_min || 0,
        notes: '',
        sentiment: r.sentiment_label
          ? {
              label: String(r.sentiment_label),
              score:
                r.sentiment_score !== null
                  ? Number(r.sentiment_score)
                  : null,
            }
          : null,
        analyzedAt: r.analyzed_at || null,
      };
    });
  }

  analyzeSession(userId, payload = {}) {
    let { id, sentiment_label = null, sentiment_score = null } = payload;

    if (!id) {
      throw new InsightsServiceError('id is required', 400);
    }

    // Accept both "timer_123" and 123
    if (typeof id === 'string' && id.startsWith('timer_')) {
      id = id.replace('timer_', '');
    }
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new InsightsServiceError('Invalid id format', 400);
    }

    const row = this.repository.findTimerSessionForUser(numericId, userId);
    if (!row) {
      throw new InsightsServiceError('Timer session not found', 404);
    }

    // Normalize score to number if provided
    if (sentiment_score !== null && sentiment_score !== undefined) {
      const scoreNum = Number(sentiment_score);
      if (!Number.isFinite(scoreNum)) {
        throw new InsightsServiceError('sentiment_score must be numeric', 400);
      }
      sentiment_score = scoreNum;
    }

    const timestamp = this.clock().toISOString();

    this.repository.updateTimerSentiment(
      numericId,
      userId,
      timestamp,
      sentiment_label,
      sentiment_score
    );

    let repId;
    if (row.session_group_id) {
      const rep = this.repository.getRepresentativeIdForGroup(
        userId,
        row.session_group_id
      );
      repId = rep || numericId;
    } else {
      repId = numericId;
    }

    return {
      id: `timer_${repId}`,
      analyzedAt: timestamp,
      sentiment: {
        label: sentiment_label,
        score: sentiment_score,
      },
    };
  }
}

module.exports = InsightsService;
