const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, university } = req.body;

    if (!email || !password || !full_name || !university) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'email, password, full_name, and university are required',
      });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        data: null,
        message: 'Email already registered',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, university)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, university, created_at`,
      [email, password_hash, full_name, university]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'User registered successfully',
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Server error during registration',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'email and password are required',
      });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, full_name, university FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Invalid email or password',
      });
    }

    const user = result.rows[0];


    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Invalid email or password',
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          university: user.university,
        },
      },
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Server error during login',
    });
  }
});

module.exports = router;
