const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/timer/active - Check for active timer session
router.get('/active', async (req, res) => {
  try {
    const userId = req.user.id; // From your auth middleware

    const { data, error } = await supabase
      .from('timer_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json(data || null);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

// POST /api/timer/start - Start new timer session
router.post('/start', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      session_template_id,
      duration_minutes,
      phase,
      current_cycle = 0,
      target_cycles = 4
    } = req.body;

    const { data, error } = await supabase
      .from('timer_sessions')
      .insert({
        user_id: userId,
        session_template_id,
        duration_minutes,
        phase,
        current_cycle,
        target_cycles,
        completed: false,
        paused: false,
        start_time: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error starting timer:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// POST /api/timer/pause - Pause current timer
router.post('/pause', async (req, res) => {
  try {
    const { timer_id } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('timer_sessions')
      .update({ paused: true })
      .eq('id', timer_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error pausing timer:', error);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

// POST /api/timer/resume - Resume paused timer
router.post('/resume', async (req, res) => {
  try {
    const { timer_id } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('timer_sessions')
      .update({ paused: false })
      .eq('id', timer_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error resuming timer:', error);
    res.status(500).json({ error: 'Failed to resume timer' });
  }
});

// POST /api/timer/stop - Stop and complete timer
router.post('/stop', async (req, res) => {
  try {
    const { timer_id } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('timer_sessions')
      .update({
        completed: true,
        end_time: new Date().toISOString()
      })
      .eq('id', timer_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error stopping timer:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// POST /api/timer/complete - Mark session complete (for phase transitions)
router.post('/complete', async (req, res) => {
  try {
    const { timer_id } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('timer_sessions')
      .update({
        completed: true,
        end_time: new Date().toISOString()
      })
      .eq('id', timer_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error completing timer session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

module.exports = router;