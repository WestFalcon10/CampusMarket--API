const express = require('express');
const router = express.Router();
const pool = require('../src/config/db');
const { authenticateToken } = require('../middleware/auth');

router.post('/:item_id', authenticateToken, async (req, res) => {
  try {
    const { item_id } = req.params;
    const user_id = req.user.id;

    const listing = await pool.query(
      'SELECT id FROM listings WHERE id = $1 AND status = $2',
      [item_id, 'active']
    );
    if (listing.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Listing not found' });
    }

    const existing = await pool.query(
      'SELECT id FROM watchlist WHERE user_id = $1 AND item_id = $2',
      [user_id, item_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, data: null, message: 'Already in watchlist' });
    }

    const result = await pool.query(
      'INSERT INTO watchlist (user_id, item_id) VALUES ($1, $2) RETURNING id, user_id, item_id, created_at',
      [user_id, item_id]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Added to watchlist' });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error adding to watchlist' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT w.id, w.created_at,
              l.id AS item_id, l.title, l.description, l.price, l.status, l.category_id
       FROM watchlist w
       JOIN listings l ON l.id = w.item_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [user_id]
    );

    res.status(200).json({ success: true, data: result.rows, message: 'Watchlist fetched successfully' });
  } catch (error) {
    console.error('Get watchlist error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error fetching watchlist' });
  }
});

router.delete('/:item_id', authenticateToken, async (req, res) => {
  try {
    const { item_id } = req.params;
    const user_id = req.user.id;

    const result = await pool.query(
      'DELETE FROM watchlist WHERE user_id = $1 AND item_id = $2 RETURNING id',
      [user_id, item_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Watchlist entry not found' });
    }

    res.status(200).json({ success: true, data: null, message: 'Removed from watchlist' });
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error removing from watchlist' });
  }
});

module.exports = router;
