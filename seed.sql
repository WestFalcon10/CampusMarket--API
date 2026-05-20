INSERT INTO categories (name) VALUES
  ('Textbooks'),
  ('Electronics'),
  ('Furniture'),
  ('Clothing'),
  ('Sports'),
  ('Music'),
  ('Gaming'),
  ('Appliances'),
  ('Stationery'),
  ('Other')
ON CONFLICT (name) DO NOTHING;
