const { supabase } = require('../database');

// Middleware to protect routes that require authentication.
// It verifies a Bearer token, retrieves the corresponding user from Supabase,
// and attaches the user object to req.user for downstream route handlers.
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Reject requests without a proper Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Validate token with Supabase and retrieve user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach verified user info to request object
    req.user = user;
    next();
  } catch (error) {
    // fallback for unexpected auth failures
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { requireAuth };
