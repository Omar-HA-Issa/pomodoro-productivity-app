const router = require("express").Router();
const supabase = require("../database");
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, target_pomodoros = 1, notes = null } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });

    const { data, error } = await supabase
      .from('sessions')
      .insert([{
        title,
        target_pomodoros,
        notes,
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

router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { title, target_pomodoros = 1, notes = null } = req.body || {};

    const { data, error } = await supabase
      .from('sessions')
      .update({ title, target_pomodoros, notes })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "not found" });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const { error } = await supabase
      .from('sessions')
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