const router = require("express").Router();
const supabase = require("../database");
const { requireAuth } = require("../middleware/authMiddleware");
router.use(requireAuth);

// GET /api/sessions - Get user's session
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')  // Changed from 'session_templates'
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sessions - Create new session
router.post("/", async (req, res) => {
  try {
    const { name, focus_duration, break_duration, description } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!focus_duration || focus_duration < 1) {
      return res.status(400).json({ error: "Focus duration must be at least 1 minute" });
    }
    if (!break_duration || break_duration < 1) {
      return res.status(400).json({ error: "Break duration must be at least 1 minute" });
    }

    const { data, error } = await supabase
      .from('sessions')  // Changed from 'session_templates'
      .insert([{
        name: name.trim(),
        focus_duration: parseInt(focus_duration),
        break_duration: parseInt(break_duration),
        description: description?.trim() || null,
        user_id: req.user.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sessions/:id - Get specific session
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')  // Changed from 'session_templates'
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/sessions/:id - Update session
router.put("/:id", async (req, res) => {
  try {
    const { name, focus_duration, break_duration, description } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!focus_duration || focus_duration < 1) {
      return res.status(400).json({ error: "Focus duration must be at least 1 minute" });
    }
    if (!break_duration || break_duration < 1) {
      return res.status(400).json({ error: "Break duration must be at least 1 minute" });
    }

    const { data, error } = await supabase
      .from('sessions')  // Changed from 'session_templates'
      .update({
        name: name.trim(),
        focus_duration: parseInt(focus_duration),
        break_duration: parseInt(break_duration),
        description: description?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sessions/:id - Delete session
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from('sessions')  // Changed from 'session_templates'
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;