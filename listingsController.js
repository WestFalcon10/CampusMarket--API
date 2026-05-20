const pool = require('./src/config/db');

exports.createListing = async (req, res) => {
  try {
    const { title, description, price, status, category_id } = req.body;
    const seller_id = req.user.id;

    if (!title || price == null || !category_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'title, price, and category_id are required',
      });
    }

    const result = await pool.query(
      `INSERT INTO listings (seller_id, category_id, title, description, price, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, seller_id, category_id, title, description, price, status, created_at`,
      [seller_id, category_id, title, description ?? null, price, status ?? 'active']
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Listing created successfully',
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Server error creating listing',
    });
  }
};

exports.getAllListings = async (req, res) => {
  try {
    const { category_id, minPrice, maxPrice, keyword } = req.query;
    const params = [];
    const conditions = [`status = 'active'`];

    if (category_id) {
      params.push(category_id);
      conditions.push(`category_id = $${params.length}`);
    }
    if (minPrice != null) {
      params.push(minPrice);
      conditions.push(`price >= $${params.length}`);
    }
    if (maxPrice != null) {
      params.push(maxPrice);
      conditions.push(`price <= $${params.length}`);
    }
    if (keyword) {
      params.push(`%${keyword}%`);
      conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }

    const result = await pool.query(
      `SELECT id, seller_id, category_id, title, description, price, status, created_at, updated_at
       FROM listings
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      params
    );

    res.status(200).json({
      success: true,
      data: result.rows,
      message: 'Listings fetched successfully',
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Server error fetching listings',
    });
  }
};

exports.updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, status, category_id } = req.body;

    const existing = await pool.query(
      'SELECT id, seller_id, price FROM listings WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Listing not found',
      });
    }

    if (existing.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Not authorized to update this listing',
      });
    }

    const oldPrice = existing.rows[0].price;

    const result = await pool.query(
      `UPDATE listings
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           status = COALESCE($4, status),
           category_id = COALESCE($5, category_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, seller_id, category_id, title, description, price, status, updated_at`,
      [title, description, price, status, category_id, id]
    );

    const updated = result.rows[0];
    if (price != null && Number(price) < Number(oldPrice)) {
      const watchers = await pool.query(
        'SELECT user_id FROM watchlist WHERE item_id = $1',
        [id]
      );
      if (watchers.rows.length > 0) {
        const message = `Price drop! ${updated.title} is now $${Number(updated.price).toFixed(2)}`;
        const insertValues = watchers.rows
          .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
          .join(', ');
        const insertParams = watchers.rows.flatMap((w) => [w.user_id, id, 'price_drop', message]);
        await pool.query(
          `INSERT INTO notifications (user_id, item_id, type, message) VALUES ${insertValues}`,
          insertParams
        );
      }
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Listing updated successfully',
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Server error updating listing',
    });
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id, seller_id FROM listings WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Listing not found',
      });
    }

    if (existing.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Not authorized to delete this listing',
      });
    }

    await pool.query(
      `UPDATE listings SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    res.status(200).json({
      success: true,
      data: { id: Number(id) },
      message: 'Listing deleted successfully',
    });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Server error deleting listing',
    });
  }
};
