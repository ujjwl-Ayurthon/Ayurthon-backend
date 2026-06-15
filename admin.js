const express = require('express');
const router = express.Router();

// POST /api/admin/login
router.post('/login', function(req, res) {
  var password = req.body && req.body.password;
  if (!password) {
    return res.status(400).json({ success: false, message: "Password required hai." });
  }
  var envPassword = (process.env.ADMIN_PASSWORD || "0604").toString().trim();
  if (password.toString().trim() === envPassword) {
    return res.json({ success: true, token: envPassword });
  }
  return res.status(401).json({ success: false, message: "Galat password." });
});

module.exports = router;
