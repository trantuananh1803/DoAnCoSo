const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../database/db");
const authenticateJWT = require("../middleware/authenticateJWT");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "email_exists" });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, 'customer') RETURNING id, full_name, email, role`,
    [full_name, email, password_hash]
  );
  const user = result.rows[0];

  const token = jwt.sign({ user_id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });
  res.status(201).json({ user, token });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const token = jwt.sign({ user_id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });
  delete user.password_hash;
  res.json({ user, token });
});

router.get("/me", authenticateJWT, async (req, res) => {
  const result = await pool.query(
    "SELECT id, full_name, email, role FROM users WHERE id=$1",
    [req.user.user_id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "user_not_found" });
  }
  res.json({ user: result.rows[0] });
});

module.exports = router;