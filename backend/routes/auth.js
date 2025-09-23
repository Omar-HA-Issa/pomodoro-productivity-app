const router = require("express").Router();
const supabase = require("../database");

router.post("/signup", async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: first_name || null,
          last_name: last_name || null,
        }
      }
    });

    if (error) throw error;
    res.status(201).json({ user: data.user, message: "Check email for confirmation" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    res.json({ user: data.user, session: data.session });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

router.post("/signout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await supabase.auth.getUser(token);
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    res.json({ message: "Signed out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;