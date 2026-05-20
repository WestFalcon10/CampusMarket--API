-- Migration: align watchlist with the listings table
-- Drop FK to items
ALTER TABLE watchlist DROP CONSTRAINT watchlist_item_id_fkey;

-- Rename column
ALTER TABLE watchlist RENAME COLUMN item_id TO listing_id;

-- Add FK to listings
ALTER TABLE watchlist ADD CONSTRAINT watchlist_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES listings(id);
