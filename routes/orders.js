/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Purchase flow and order management
 *
 * /orders/{listing_id}:
 *   post:
 *     summary: Buy a listing — creates a pending order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listing_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Cannot buy own listing or listing unavailable
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Listing not found
 *
 * /orders:
 *   get:
 *     summary: Get current user's orders (as buyer and seller)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of orders
 *
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status (seller confirms/completes/cancels; buyer cancels)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, completed, cancelled]
 *     responses:
 *       200:
 *         description: Order status updated
 *       400:
 *         description: Invalid status transition
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Order not found
 *
 * /orders/{id}:
 *   get:
 *     summary: Get a single order's details
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Order not found
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../src/config/db');
const { authenticateToken } = require('../middleware/auth');

// ── POST /orders/:listing_id — Buy an item ──────────────────────────────────
router.post('/:listing_id', authenticateToken, async (req, res) => {
  try {
    const buyer_id   = req.user.id;
    const listing_id = parseInt(req.params.listing_id, 10);

    if (isNaN(listing_id)) {
      return res.status(400).json({ success: false, data: null, message: 'Invalid listing id' });
    }

    // Fetch listing + seller name in one query
    const listingRes = await pool.query(
      `SELECT l.*, u.full_name AS seller_name
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       WHERE l.id = $1 AND l.status = 'active'`,
      [listing_id]
    );

    if (listingRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Listing not found or no longer available' });
    }

    const listing = listingRes.rows[0];

    if (listing.seller_id === buyer_id) {
      return res.status(400).json({ success: false, data: null, message: 'You cannot buy your own listing' });
    }

    // Create order
    const orderRes = await pool.query(
      `INSERT INTO orders (listing_id, buyer_id, seller_id, price, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [listing_id, buyer_id, listing.seller_id, listing.price]
    );
    const order = orderRes.rows[0];

    // Mark listing as sold
    await pool.query(
      `UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [listing_id]
    );

    // Notify seller
    pool.query(
      `INSERT INTO notifications (user_id, item_id, type, message) VALUES ($1, $2, $3, $4)`,
      [listing.seller_id, listing_id, 'order_new', `Someone wants to buy your "${listing.title}"!`]
    ).catch((e) => console.error('Notification error:', e));

    // Notify buyer
    pool.query(
      `INSERT INTO notifications (user_id, item_id, type, message) VALUES ($1, $2, $3, $4)`,
      [buyer_id, listing_id, 'order_pending', `Your order for "${listing.title}" is pending confirmation`]
    ).catch((e) => console.error('Notification error:', e));

    res.status(201).json({ success: true, data: order, message: 'Order placed successfully' });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error creating order' });
  }
});

// ── GET /orders — User's orders (buyer + seller) ────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT o.*,
              l.title     AS listing_title,
              l.images    AS listing_images,
              l.category_id,
              buyer.full_name  AS buyer_name,
              seller.full_name AS seller_name
       FROM orders o
       LEFT JOIN listings l  ON o.listing_id  = l.id
       JOIN  users buyer     ON o.buyer_id     = buyer.id
       JOIN  users seller    ON o.seller_id    = seller.id
       WHERE o.buyer_id = $1 OR o.seller_id = $1
       ORDER BY o.created_at DESC`,
      [user_id]
    );

    res.status(200).json({ success: true, data: result.rows, message: 'Orders fetched successfully' });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error fetching orders' });
  }
});

// ── PATCH /orders/:id/status — Update order status ─────────────────────────
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    const user_id    = req.user.id;

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, data: null, message: 'Invalid status value' });
    }

    const orderRes = await pool.query(
      `SELECT o.*, l.title AS listing_title
       FROM orders o
       LEFT JOIN listings l ON o.listing_id = l.id
       WHERE o.id = $1`,
      [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Order not found' });
    }

    const order    = orderRes.rows[0];
    const isSeller = order.seller_id === user_id;
    const isBuyer  = order.buyer_id  === user_id;

    if (!isSeller && !isBuyer) {
      return res.status(403).json({ success: false, data: null, message: 'Not authorized' });
    }

    // Buyers can only cancel
    if (isBuyer && !isSeller && status !== 'cancelled') {
      return res.status(403).json({ success: false, data: null, message: 'Buyers can only cancel orders' });
    }

    // Validate status transition
    const allowed = {
      pending:   ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };
    if (!allowed[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false, data: null,
        message: `Cannot change status from '${order.status}' to '${status}'`,
      });
    }

    const updated = await pool.query(
      `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    // Notify buyer when seller acts
    if (isSeller) {
      const msgs = {
        confirmed: `Your order for "${order.listing_title}" has been confirmed! 🎉`,
        completed: `Your order for "${order.listing_title}" is complete ✅`,
        cancelled: `Your order for "${order.listing_title}" was cancelled by the seller`,
      };
      if (msgs[status]) {
        pool.query(
          `INSERT INTO notifications (user_id, item_id, type, message) VALUES ($1, $2, $3, $4)`,
          [order.buyer_id, order.listing_id, `order_${status}`, msgs[status]]
        ).catch((e) => console.error('Notification error:', e));
      }
    }

    // Re-activate listing if cancelled
    if (status === 'cancelled' && order.listing_id) {
      await pool.query(
        `UPDATE listings SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [order.listing_id]
      );
    }

    res.status(200).json({ success: true, data: updated.rows[0], message: 'Order status updated' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error updating order status' });
  }
});

// ── GET /orders/:id — Single order details ──────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id }  = req.params;
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT o.*,
              l.title       AS listing_title,
              l.images      AS listing_images,
              l.category_id,
              l.description AS listing_description,
              buyer.full_name   AS buyer_name,
              buyer.university  AS buyer_university,
              seller.full_name  AS seller_name,
              seller.university AS seller_university
       FROM orders o
       LEFT JOIN listings l   ON o.listing_id = l.id
       JOIN  users buyer      ON o.buyer_id    = buyer.id
       JOIN  users seller     ON o.seller_id   = seller.id
       WHERE o.id = $1 AND (o.buyer_id = $2 OR o.seller_id = $2)`,
      [id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: 'Order not found' });
    }

    res.status(200).json({ success: true, data: result.rows[0], message: 'Order fetched successfully' });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error fetching order' });
  }
});

module.exports = router;
