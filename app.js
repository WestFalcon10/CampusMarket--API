require('dotenv').config();

const express = require('express');
const cors = require('cors');
const listingsRoutes = require('./listingsRoutes');
const usersRoutes = require('./routes/users');
const watchlistRoutes = require('./routes/watchlist');
const notificationsRoutes = require('./routes/notifications');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: { name: 'CampusMarket API' },
    message: 'API is running',
  });
});

app.use('/listings', listingsRoutes);
app.use('/users', usersRoutes);
app.use('/watchlist', watchlistRoutes);
app.use('/notifications', notificationsRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CampusMarket API listening on port ${PORT}`);
});

module.exports = app;
