const express = require('express');
const router = express.Router();
const pool = require('../src/config/db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, item_id, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.status(200).json({ success: true, data: result.rows, message: 'Notifications fetched successfully' });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error fetching notifications' });
  }
});

router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, item_id, message, is_read, created_at`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, data: result.rows[0], message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error updating notification' });
  }
});

module.exports = router;
