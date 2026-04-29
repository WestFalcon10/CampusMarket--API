// listingsController.js

// 1. CREATE: Logic to add a new item for sale
exports.createListing = async (req, res) => {
    try {
        const { title, description, price, status } = req.body;
        // This will eventually save data to the LISTINGS table
        res.status(201).json({ 
            message: "Listing created successfully!",
            data: { title, price, status }
        });
    } catch (error) {
        res.status(500).json({ error: "Server error creating listing" });
    }
};

// 2. READ: Logic to show all items available
exports.getAllListings = async (req, res) => {
    try {
        // This will eventually fetch all rows from the LISTINGS table
        res.status(200).json({ message: "Fetching all active student listings..." });
    } catch (error) {
        res.status(500).json({ error: "Server error fetching listings" });
    }
};
// listingsRoutes.js
const express = require('express');
const router = express.Router();
const listingsController = require('./listingsController');

// CREATE: Route to add a new listing [cite: 119]
router.post('/add', listingsController.createListing);

// READ: Route to get all listings [cite: 120]
router.get('/all', listingsController.getAllListings);

// UPDATE: Route to edit a listing [cite: 58]
router.put('/update/:id', listingsController.updateListing);

// DELETE: Route to remove a listing [cite: 58]
router.delete('/delete/:id', listingsController.deleteListing);

module.exports = router;
