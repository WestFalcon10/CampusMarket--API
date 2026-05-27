/**
 * @swagger
 * tags:
 *   name: Listings
 *   description: Marketplace listing management
 *
 * /listings/all:
 *   get:
 *     summary: Get all active listings with optional filters
 *     tags: [Listings]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filter by category
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price
 *     responses:
 *       200:
 *         description: List of active listings
 *
 * /listings/add:
 *   post:
 *     summary: Create a new listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, price, category_id]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category_id:
 *                 type: integer
 *               status:
 *                 type: string
 *                 default: active
 *     responses:
 *       201:
 *         description: Listing created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *
 * /listings/update/{id}:
 *   put:
 *     summary: Update an existing listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category_id:
 *                 type: integer
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Listing updated successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Listing not found
 *
 * /listings/delete/{id}:
 *   delete:
 *     summary: Soft-delete a listing (sets status to inactive)
 *     tags: [Listings]
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
 *         description: Listing deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Listing not found
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { upload } = require('./src/config/cloudinary');
const router = express.Router();
const listingsController = require('./listingsController');
const { authenticateToken } = require('./middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, message: errors.array()[0].msg });
  }
  next();
};

const listingRules = [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('description').optional().isString().withMessage('description must be a string'),
  body('price').isFloat({ gt: 0 }).withMessage('price must be a positive number'),
  body('category_id').isInt({ gt: 0 }).withMessage('category_id must be a positive integer'),
  body('condition').optional().isString(),
];

const updateRules = [
  body('title').optional().trim().notEmpty().withMessage('title cannot be empty'),
  body('description').optional().isString(),
  body('price').optional().isFloat({ gt: 0 }).withMessage('price must be a positive number'),
  body('category_id').optional().isInt({ gt: 0 }).withMessage('category_id must be a positive integer'),
  body('condition').optional().isString(),
];

router.post('/add', authenticateToken, upload.array('images', 5), listingRules, validate, listingsController.createListing);
router.get('/all', listingsController.getAllListings);
router.put('/update/:id', authenticateToken, updateRules, validate, listingsController.updateListing);
router.delete('/delete/:id', authenticateToken, listingsController.deleteListing);

module.exports = router;
