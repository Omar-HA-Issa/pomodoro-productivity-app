const TimerRepository = require('../repositories/timer.repository');

class ServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const VALID_PHASES = new Set(['focus', 'short_break', 'long_break']);

class TimerService {
  constructor(repository = new TimerRepository(), clock = () => new Date()) {
    this.repository = repository;
    this.clock = clock;
  }

  getActiveSession(userId) {
    return this.repository.getActiveSession(userId) || null;
  }

  startTimer(userId, payload = {}) {
    const {
      session_template_id = null,
      duration_minutes,
      phase = 'focus',
      current_cycle = 0,
      target_cycles = 4,
      session_group_id = null,
    } = payload;

    const duration = this._parseDuration(duration_minutes);
    this._validatePhase(phase);

    const now = this.clock().toISOString();

    const id = this.repository.createSession({
      user_id: userId,
      session_template_id,
      duration_minutes: duration,
      phase,
      current_cycle: Number(current_cycle),
      target_cycles: Number(target_cycles),
      start_time: now,
      created_at: now,
      session_group_id,
    });

    return this.repository.getSessionById(id);
  }

  pauseTimer(userId) {
    const active = this._ensureActiveSession(userId, 'pause');
    return this.repository.updatePausedStatus(active.id, userId, true);
  }

  resumeTimer(userId) {
    const active = this._ensureActiveSession(userId, 'resume');
    return this.repository.updatePausedStatus(active.id, userId, false);
  }

  stopTimer(userId) {
    const active = this._ensureActiveSession(userId, 'stop');
    const timestamp = this.clock().toISOString();
    return this.repository.completeSession(active.id, userId, timestamp);
  }

  completeTimer(userId, timerId) {
    if (!timerId) {
      throw new ServiceError('timer_id is required', 400);
    }

    const existing = this.repository.getSessionByIdForUser(timerId, userId);
    if (!existing) {
      throw new ServiceError('Timer session not found', 404);
    }

    const timestamp = this.clock().toISOString();
    return this.repository.completeSession(timerId, userId, timestamp);
  }

  updateNotes(userId, id, notes = null) {
    const existing = this.repository.getSessionByIdForUser(id, userId);
    if (!existing) {
      throw new ServiceError('Timer session not found', 404);
    }

    return this.repository.updateSessionNotes(id, userId, notes);
  }

  getHistory(userId, limitRaw) {
    const maybeNumber = Number(limitRaw ?? 50);
    const safeLimit = Number.isFinite(maybeNumber)
      ? Math.min(200, Math.max(1, maybeNumber))
      : 50;

    return this.repository.getHistory(userId, safeLimit);
  }

  // ---------- private helpers (service-level business rules) ----------

  _ensureActiveSession(userId, action) {
    const active = this.repository.getActiveSession(userId);
    if (!active) {
      throw new ServiceError(`No active timer to ${action}`, 404);
    }
    return active;
  }

  _parseDuration(durationMinutes) {
    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new ServiceError('duration_minutes is required and must be > 0', 400);
    }
    return duration;
  }

  _validatePhase(phase) {
    if (!VALID_PHASES.has(phase)) {
      throw new ServiceError(
        `Invalid phase. Use one of: ${Array.from(VALID_PHASES).join(', ')}`,
        400
      );
    }
  }
}

module.exports = TimerService;
