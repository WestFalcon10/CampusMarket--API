-- Campus Market (PostgreSQL)

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    university    VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listings (
    id          SERIAL PRIMARY KEY,
    seller_id   INT NOT NULL,
    category_id INT NOT NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    price       DECIMAL(10, 2) NOT NULL,
    condition   VARCHAR(50),
    status      VARCHAR(50) DEFAULT 'active',
    images      TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_listing_seller   FOREIGN KEY (seller_id)   REFERENCES users(id),
    CONSTRAINT fk_listing_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE watchlist (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL,
    listing_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_watchlist_user    FOREIGN KEY (user_id)    REFERENCES users(id),
    CONSTRAINT fk_watchlist_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
);

CREATE TABLE notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL,
    item_id    INT,
    type       VARCHAR(50) NOT NULL,
    message    TEXT NOT NULL,
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id)
);
