const router = require("express").Router();
const supabase = require("../database");
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('user_id', req.user.id);

    if (from) query = query.gte('start_datetime', from);
    if (to) query = query.lt('start_datetime', to);

    const { data, error } = await query.order('start_datetime', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { session_id = null, title = null, start_datetime, duration_min = 25 } = req.body || {};
    if (!start_datetime) return res.status(400).json({ error: "start_datetime is required (ISO8601)" });
    if (!session_id && !title) return res.status(400).json({ error: "provide session_id or title" });

    const { data, error } = await supabase
      .from('scheduled_sessions')
      .insert([{
        session_id,
        title,
        start_datetime,
        duration_min,
        user_id: req.user.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const { error } = await supabase
      .from('scheduled_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;