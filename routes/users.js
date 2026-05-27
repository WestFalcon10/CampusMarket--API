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
 * /users/profile:
 *   get:
 *     summary: Get current user's profile with stats
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data including active_listings and completed_orders counts
 *   patch:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               university:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
const { authenticateToken } = require('../middleware/auth');

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

// ── GET /users/profile ────────────────────────────────
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const [userRes, listingsRes, ordersRes] = await Promise.all([
      pool.query(
        'SELECT id, email, full_name, university, phone, created_at FROM users WHERE id = $1',
        [user_id]
      ),
      pool.query(
        `SELECT COUNT(*) FROM listings WHERE seller_id = $1 AND status = 'active'`,
        [user_id]
      ),
      pool.query(
        `SELECT COUNT(*) FROM orders WHERE (buyer_id = $1 OR seller_id = $1) AND status = 'completed'`,
        [user_id]
      ),
    ]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        ...userRes.rows[0],
        active_listings:  parseInt(listingsRes.rows[0].count, 10),
        completed_orders: parseInt(ordersRes.rows[0].count, 10),
      },
      message: 'Profile fetched successfully',
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error fetching profile' });
  }
});

// ── PATCH /users/profile ──────────────────────────────
router.patch(
  '/profile',
  authenticateToken,
  [
    body('full_name').trim().notEmpty().withMessage('full_name is required'),
    body('university').trim().notEmpty().withMessage('university is required'),
    body('phone').optional({ checkFalsy: true }).trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { full_name, university, phone } = req.body;
      const user_id = req.user.id;

      const result = await pool.query(
        `UPDATE users SET full_name = $1, university = $2, phone = $3 WHERE id = $4
         RETURNING id, email, full_name, university, phone, created_at`,
        [full_name, university, phone || null, user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, data: null, message: 'User not found' });
      }

      res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, data: null, message: 'Server error updating profile' });
    }
  }
);

module.exports = router;
