/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User registration and authentication
 *
 * /users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, full_name, university]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               full_name:
 *                 type: string
 *               university:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or missing fields
 *       409:
 *         description: Email already registered
 *
 * /users/login:
 *   post:
 *     summary: Log in and receive a JWT token
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid email or password
 */
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool    = require('../src/config/db');

const router = express.Router();

// ── Validation middleware helper ──────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      data: null,
      message: errors.array()[0].msg,
    });
  }
  next();
};

// ── Register ──────────────────────────────────────────────
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('full_name').trim().notEmpty().withMessage('full_name is required'),
    body('university').trim().notEmpty().withMessage('university is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, full_name, university } = req.body;

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
      res.status(500).json({ success: false, data: null, message: 'Server error during registration' });
    }
  }
);

// ── Login ────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const result = await pool.query(
        'SELECT id, email, password_hash, full_name, university FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, data: null, message: 'Invalid email or password' });
      }

      const user  = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, data: null, message: 'Invalid email or password' });
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
          user: { id: user.id, email: user.email, full_name: user.full_name, university: user.university },
        },
        message: 'Login successful',
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, data: null, message: 'Server error during login' });
    }
  }
);

module.exports = router;
