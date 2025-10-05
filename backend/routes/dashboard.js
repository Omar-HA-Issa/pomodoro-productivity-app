const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const db = new Database('./pomodoro.db');
const { requireAuth } = require('../middleware/authMiddleware');

// This router serves read-only dashboard data derived from two sources:
// - timer_sessions (historical, completed focus/break rows)
// - scheduled_sessions (future/plan items)
// All routes are auth-protected per-user via requireAuth.

/**
 * Helper: compute the user's *current* daily streak from completed sessions.
 * A "streak day" is counted if the user had at least one completed session that day.
 * It iterates backwards from today and stop at the first gap.
 */
function calculateCurrentStreak(userId) {
  // Distinct YYYY-MM-DD dates with a completed session for this user (latest first)
  const sessionDates = db.prepare(`
    SELECT DISTINCT DATE(created_at) as session_date
    FROM timer_sessions 
    WHERE user_id = ? AND completed = 1
    ORDER BY session_date DESC
  `).all(userId);

  if (sessionDates.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sessionDates.length; i++) {
    const sessionDate = new Date(sessionDates[i].session_date);
    sessionDate.setHours(0, 0, 0, 0);

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

/**
 * Helper: compute the user's *longest ever* daily streak across history.
 * We look at consecutive-day gaps in DISTINCT completed-session dates.
 */
function calculateLongestStreak(userId) {
  const sessionDates = db.prepare(`
    SELECT DISTINCT DATE(created_at) as session_date
    FROM timer_sessions 
    WHERE user_id = ? AND completed = 1
    ORDER BY session_date ASC
  `).all(userId);

  if (sessionDates.length === 0) return 0;

  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sessionDates.length; i++) {
    const prevDate = new Date(sessionDates[i - 1].session_date);
    const currDate = new Date(sessionDates[i].session_date);

    const diffTime = currDate - prevDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      // gap found so restart counting
      currentStreak = 1;
    }
  }

  return longestStreak;
}

/**
 * Helper: total number of *distinct* active days (days with ≥1 completed session).
 */
function getTotalActiveDays(userId) {
  const result = db.prepare(`
    SELECT COUNT(DISTINCT DATE(created_at)) as total 
    FROM timer_sessions 
    WHERE user_id = ? AND completed = 1
  `).get(userId);

  return result ? result.total : 0;
}

/**
 * GET /api/dashboard/streak
 * Returns streak metrics based strictly on completed timer_sessions rows.
 */
router.get('/streak', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;

    const currentStreak = calculateCurrentStreak(userId);
    const longestStreak = calculateLongestStreak(userId);
    const totalDays = getTotalActiveDays(userId);

    // Most recent day with a completed session; if none, fallback to today so UI can show a value.
    const lastSession = db.prepare(`
      SELECT DATE(created_at) as last_date
      FROM timer_sessions 
      WHERE user_id = ? AND completed = 1
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);

    const lastLoginDate = lastSession
      ? lastSession.last_date
      : new Date().toISOString().split('T')[0];

    res.json({
      currentStreak,
      longestStreak,
      totalDays,
      lastLoginDate
    });
  } catch (error) {
    console.error('Error fetching streak:', error);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

/**
 * GET /api/dashboard/today-schedule
 * Returns today's scheduled_sessions joined with session templates (if linked).
 * The response is simplified to the shape the frontend dashboard expects.
 */
router.get('/today-schedule', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const sessions = db.prepare(`
      SELECT 
        s.id,
        s.session_id,
        s.title,
        s.start_datetime,
        s.duration_min,
        ses.name as session_name,
        ses.focus_duration,
        ses.break_duration
      FROM scheduled_sessions s
      LEFT JOIN sessions ses ON s.session_id = ses.id
      WHERE s.user_id = ? AND DATE(s.start_datetime) = ?
      ORDER BY s.start_datetime ASC
    `).all(userId, today);

    const formattedSessions = sessions.map(session => {
      const startTime = new Date(session.start_datetime);
      return {
        id: session.id.toString(),
        time: startTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        title: session.title || session.session_name || 'Untitled Session',
        duration: `${session.duration_min || session.focus_duration || 25} min`,
        type: 'focus',
        completed: false
      };
    });

    res.json(formattedSessions);
  } catch (error) {
    console.error('Error fetching today\'s schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

/**
 * GET /api/dashboard/stats
 * Returns simple 7-day stats (count, total minutes, average length) from completed rows.
 */
router.get('/stats', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as sessions_completed,
        SUM(duration_minutes) as total_focus_time,
        AVG(duration_minutes) as average_session
      FROM timer_sessions
      WHERE user_id = ? 
        AND completed = 1
        AND created_at >= ?
    `).get(userId, weekAgo.toISOString());

    res.json({
      totalFocusTime: `${stats.total_focus_time || 0}m`,
      sessionsCompleted: stats.sessions_completed || 0,
      averageSession: `${Math.round(stats.average_session || 0)}m`
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/dashboard/overview
 * One-shot aggregated endpoint combining:
 *  - streak metrics,
 *  - today's schedule,
 *  - and user's session templates.
 */
router.get('/overview', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Streak metrics
    const currentStreak = calculateCurrentStreak(userId);
    const longestStreak = calculateLongestStreak(userId);
    const totalDays = getTotalActiveDays(userId);

    // Last activity day (or today if none)
    const lastSession = db.prepare(`
      SELECT DATE(created_at) as last_date
      FROM timer_sessions 
      WHERE user_id = ? AND completed = 1
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);

    const lastLoginDate = lastSession
      ? lastSession.last_date
      : today;

    // Today's schedule items joined with templates (name/focus)
    const sessions = db.prepare(`
      SELECT 
        s.id,
        s.session_id,
        s.title,
        s.start_datetime,
        s.duration_min,
        ses.name as session_name,
        ses.focus_duration
      FROM scheduled_sessions s
      LEFT JOIN sessions ses ON s.session_id = ses.id
      WHERE s.user_id = ? AND DATE(s.start_datetime) = ?
      ORDER BY s.start_datetime ASC
    `).all(userId, today);

    const formattedSessions = sessions.map(session => {
      const startTime = new Date(session.start_datetime);
      return {
        id: session.id.toString(),
        time: startTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        title: session.title || session.session_name || 'Untitled Session',
        duration: `${session.duration_min || session.focus_duration || 25} min`,
        type: 'focus',
        completed: false
      };
    });

    // User's templates list for quick access in the dashboard UI
    const templates = db.prepare(`
      SELECT id, name, focus_duration, break_duration, description
      FROM sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    res.json({
      streak: {
        currentStreak,
        longestStreak,
        totalDays,
        lastLoginDate
      },
      todaysSchedule: formattedSessions,
      templates
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
