-- Campus Market AI


-- 1. USERS Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    university_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. CATEGORIES Table
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. LISTINGS Table
CREATE TABLE listings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_listing_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_listing_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 4. LISTING_IMAGES Table
CREATE TABLE listing_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    listing_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_images_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
);

-- 5. LISTING_PRICE_HISTORY Table
CREATE TABLE listing_price_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    listing_id INT NOT NULL,
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2),
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_price_history_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
);

-- 6. WATCHLISTS Table
CREATE TABLE watchlists (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    listing_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_watchlist_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
);

-- 7. NOTIFICATIONS Table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    listing_id INT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_notification_listing FOREIGN KEY (listing_id) REFERENCES listings(id)
);

-- 8. USER_SESSIONS Table
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 9. AUDIT_LOGS Table
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    table_name VARCHAR(100),
    record_id INT,
    action VARCHAR(50),
    old_data JSON,
    new_data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 10. EVENT_LOGS Table
CREATE TABLE event_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    event_type VARCHAR(100),
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_user FOREIGN KEY (user_id) REFERENCES users(id)
);
