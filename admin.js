const express = require('express');
const router = express.Router();

// 🔒 OODA FIX: Aligned Strict Type Matching to handle both String & Number Passwords safely
router.post('/login', function(req, res) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: "Password required hai bhai." });
  }

  const envPassword = (process.env.ADMIN_PASSWORD || "0604").toString().trim();
  const inputPassword = password.toString().trim();

  if (inputPassword === envPassword) {
    // Return token payload exactly matching frontend multi-shape constraints
    return res.json({
      success: true,
      token: inputPassword,
      adminToken: inputPassword,
      message: "Admin access granted successfully! 🌿"
    });
  } else {
    return res.status(401).json({ success: false, message: "Galat password entered. Dobara try karo!" });
  }
});

module.exports = router;
