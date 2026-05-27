/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Stripe payment integration
 *
 * /payments/create-checkout:
 *   post:
 *     summary: Create a Stripe Checkout session for a listing
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [listing_id]
 *             properties:
 *               listing_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Returns Stripe checkout URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     order_id:
 *                       type: integer
 *       400:
 *         description: Missing listing_id or buyer is seller
 *       403:
 *         description: Cannot buy your own listing
 *       404:
 *         description: Listing not found or unavailable
 *
 * /payments/webhook:
 *   post:
 *     summary: Stripe webhook — handles checkout.session.completed
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Event received
 */

const express = require('express');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool    = require('../src/config/db');
const { authenticateToken } = require('../middleware/auth');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── POST /payments/create-checkout ─────────────────────────────────────────
router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { listing_id } = req.body;
    const buyer_id       = req.user.id;

    if (!listing_id) {
      return res.status(400).json({ success: false, data: null, message: 'listing_id is required' });
    }

    // Fetch listing with seller info
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
      return res.status(403).json({ success: false, data: null, message: 'You cannot buy your own listing' });
    }

    // Create pending order in DB before redirecting (reserves the listing)
    const orderRes = await pool.query(
      `INSERT INTO orders (listing_id, buyer_id, seller_id, price, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [listing_id, buyer_id, listing.seller_id, listing.price]
    );
    const order = orderRes.rows[0];

    // Mark listing as sold immediately (prevents double purchases)
    await pool.query(
      `UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [listing_id]
    );

    // Build Stripe line item — images must be public HTTPS URLs
    const product_data = { name: listing.title };
    if (listing.images && listing.images.length > 0 && listing.images[0].startsWith('https://')) {
      product_data.images = [listing.images[0]];
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data,
          unit_amount: Math.round(parseFloat(listing.price) * 100), // cents
        },
        quantity: 1,
      }],
      mode:        'payment',
      success_url: `${BASE_URL}/payment-success.html?order_id=${order.id}`,
      cancel_url:  `${BASE_URL}/payment-cancel.html?order_id=${order.id}`,
      metadata: {
        listing_id: String(listing_id),
        buyer_id:   String(buyer_id),
        seller_id:  String(listing.seller_id),
        order_id:   String(order.id),
      },
    });

    res.status(200).json({
      success: true,
      data:    { url: session.url, order_id: order.id, session_id: session.id },
      message: 'Checkout session created',
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({ success: false, data: null, message: 'Server error creating checkout session' });
  }
});

// ── POST /payments/webhook ─────────────────────────────────────────────────
// express.raw() in app.js ensures req.body is a raw Buffer so Stripe can
// verify the signature against the exact bytes it sent.
router.post('/webhook', async (req, res) => {
  let event;

  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      req.body,                               // raw Buffer from express.raw()
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { listing_id, buyer_id, seller_id, order_id } = session.metadata || {};

    try {
      // Update order → confirmed
      if (order_id) {
        await pool.query(
          `UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1`,
          [order_id]
        );
      }

      // Resolve listing title for notifications
      let title = 'your item';
      if (listing_id) {
        const lr = await pool.query('SELECT title FROM listings WHERE id = $1', [listing_id]);
        if (lr.rows.length > 0) title = lr.rows[0].title;
      }

      // Notify seller
      if (seller_id && listing_id) {
        await pool.query(
          `INSERT INTO notifications (user_id, item_id, type, message) VALUES ($1, $2, $3, $4)`,
          [parseInt(seller_id, 10), parseInt(listing_id, 10), 'payment_received',
           `Payment received for "${title}"! 💰`]
        );
      }

      // Notify buyer
      if (buyer_id && listing_id) {
        await pool.query(
          `INSERT INTO notifications (user_id, item_id, type, message) VALUES ($1, $2, $3, $4)`,
          [parseInt(buyer_id, 10), parseInt(listing_id, 10), 'payment_confirmed',
           `Payment confirmed for "${title}"! ✅`]
        );
      }

      console.log(`Webhook: order ${order_id} confirmed, listing ${listing_id} sold`);
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }

  res.json({ received: true });
});

module.exports = router;
