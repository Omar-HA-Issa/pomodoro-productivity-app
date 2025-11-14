const DashboardRepository = require('../repositories/dashboard.repository');

class DashboardServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class DashboardService {
  constructor(repository = new DashboardRepository(), clock = () => new Date()) {
    this.repository = repository;
    this.clock = clock;
  }

  // Streak-related

  getStreakSummary(userId) {
    const currentStreak = this.#calculateCurrentStreak(userId);
    const longestStreak = this.#calculateLongestStreak(userId);
    const totalDays = this.repository.getTotalActiveDays(userId);
    const lastLoginDate = this.#getLastLoginDate(userId);

    return { currentStreak, longestStreak, totalDays, lastLoginDate };
  }

  #calculateCurrentStreak(userId) {
    const dates = this.repository.getDistinctDatesDesc(userId);
    if (!dates.length) return 0;

    let streak = 0;
    const today = this.#startOfDay(this.clock());

    for (let i = 0; i < dates.length; i++) {
      const sessionDate = this.#startOfDay(new Date(dates[i].session_date));
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - streak);

      if (sessionDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  #calculateLongestStreak(userId) {
    const dates = this.repository.getDistinctDatesAsc(userId);
    if (!dates.length) return 0;

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = this.#startOfDay(new Date(dates[i - 1].session_date));
      const currDate = this.#startOfDay(new Date(dates[i].session_date));

      const diffTime = currDate - prevDate;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        currentStreak = 1;
      }
    }

    return longestStreak;
  }

  #getLastLoginDate(userId) {
    const todayStr = this.#toDateString(this.clock());
    const lastSession = this.repository.getLastCompletedDate(userId);
    return lastSession ? lastSession.last_date : todayStr;
  }

  // Today schedule

  getTodaySchedule(userId) {
    const todayStr = this.#toDateString(this.clock());
    const rows = this.repository.getTodaySchedule(userId, todayStr);

    return rows.map((session) => {
      const startTime = new Date(session.start_datetime);

      return {
        id: String(session.id),
        time: startTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        title:
          session.title ||
          session.session_name ||
          'Untitled Session',
        duration: `${session.duration_min || session.focus_duration || 25} min`,
        type: 'focus',
        completed: false,
      };
    });
  }

  // Weekly stats

  getStats(userId) {
    const now = this.clock();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    const stats = this.repository.getSevenDayStats(userId, weekAgo.toISOString());

    return {
      totalFocusTime: `${stats.total_focus_time || 0}m`,
      sessionsCompleted: stats.sessions_completed || 0,
      averageSession: `${Math.round(stats.average_session || 0)}m`,
    };
  }

  // Combined overview

  getOverview(userId) {
    const streak = this.getStreakSummary(userId);
    const todaysSchedule = this.getTodaySchedule(userId);
    const templates = this.repository.getTemplates(userId);

    return { streak, todaysSchedule, templates };
  }

  // Helpers

  #startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  #toDateString(date) {
    return new Date(date).toISOString().split('T')[0];
  }
}

module.exports = DashboardService;
