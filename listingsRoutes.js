const express = require('express');
const router = express.Router();
const listingsController = require('./listingsController');
const { authenticateToken } = require('./middleware/auth');

router.post('/add', authenticateToken, listingsController.createListing);
router.get('/all', listingsController.getAllListings);
router.put('/update/:id', authenticateToken, listingsController.updateListing);
router.delete('/delete/:id', authenticateToken, listingsController.deleteListing);

module.exports = router;
