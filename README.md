# CampusMarket API

A REST API for a student marketplace platform where university students can buy and sell textbooks, electronics, furniture, and more.

## Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL

### Installation

```bash
git clone https://github.com/WestFalcon10/CampusMarket--API.git
cd CampusMarket--API
npm install
```

### Database Setup

Create the database and run the schema:

```bash
psql -U postgres -c "CREATE DATABASE campusmarket;"
psql -U postgres -d campusmarket -f schema.sql
psql -U postgres -d campusmarket -f seed.sql
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=campusmarket
DB_PORT=5432
JWT_SECRET=your_jwt_secret
```

### Running the Server

```bash
# Production
npm start

# Development
npm run dev
```

The API will be available at `http://localhost:3000`.
Interactive API docs (Swagger UI) are at `http://localhost:3000/api-docs`.

---

## API Endpoints

All protected endpoints require a `Bearer <token>` header obtained from `/users/login`.

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/register` | No | Register a new user |
| POST | `/users/login` | No | Log in and receive a JWT |

### Listings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/listings/all` | No | Get all active listings |
| POST | `/listings/add` | Yes | Create a new listing |
| PUT | `/listings/update/:id` | Yes | Update a listing |
| DELETE | `/listings/delete/:id` | Yes | Delete a listing |

**GET /listings/all query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `keyword` | string | Search title and description |
| `category_id` | integer | Filter by category |
| `minPrice` | number | Minimum price |
| `maxPrice` | number | Maximum price |

### Watchlist

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/watchlist/:id` | Yes | Add a listing to watchlist |
| GET | `/watchlist` | Yes | Get current user's watchlist |
| DELETE | `/watchlist/:id` | Yes | Remove a listing from watchlist |

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | Yes | Get current user's notifications |
| PATCH | `/notifications/:id/read` | Yes | Mark a notification as read |

---

## Categories

The seed file populates these categories:
Textbooks, Electronics, Furniture, Clothing, Sports, Music, Gaming, Appliances, Stationery, Other
