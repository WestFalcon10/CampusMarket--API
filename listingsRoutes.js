// listingsRoutes.js
const express = require('express');
const router = express.Router();
const listingsController = require('./listingsController');

// Route to create a new listing
// This matches your task to "Create API to add listings"
router.post('/add', listingsController.createListing);

// Route to get all listings
// This matches your task to "Implement basic 'get listings' functionality"
router.get('/all', listingsController.getAllListings);

module.exports = router;
