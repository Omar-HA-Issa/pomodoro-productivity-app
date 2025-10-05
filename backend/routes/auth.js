const router = require("express").Router();
const { supabase } = require("../database"); // Import Supabase client for authentication routes

// POST /api/auth/signup
// Registers a new user with email and password using Supabase Auth.
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

// POST /api/auth/signin
// Logs in an existing user via email/password and returns a Supabase session.
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

// POST /api/auth/signout
// Logs the user out of Supabase Auth using their token (if provided).
router.post("/signout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await supabase.auth.getUser(token); // verify user context (optional)
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    res.json({ message: "Signed out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/forgot-password
// Sends a password reset email with redirect URL to frontend reset page.
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`
    });

    if (error) throw error;
    res.json({ message: "Password reset email sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/update-password
// Updates a user's password after verifying access token (used after reset flow).
router.post("/update-password", async (req, res) => {
  try {
    const { password, access_token, refresh_token } = req.body;

    if (!password || !access_token) {
      return res.status(400).json({ error: "Password and access token required" });
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: access_token,
      refresh_token: refresh_token || ""
    });

    if (sessionError) {
      return res.status(401).json({ error: "Invalid or expired tokens" });
    }

    // Update user password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      throw updateError;
    }

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/profile
// Returns user profile data based on Bearer token authentication.
router.get("/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    res.json({
      id: user.id,
      email: user.email,
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      full_name: user.user_metadata?.full_name || ''
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

module.exports = router;
