# CampusMarket API

A REST API for a student marketplace platform where university students can buy and sell textbooks, electronics, furniture, and more.

---

## Running the project

### Option 1 — Docker (recommended)

Requires Docker Desktop.

```bash
docker-compose up --build
```

The API will be available at `http://localhost:3000`.
The database is created automatically using `schema.sql` and seeded with `seed.sql`.

To stop:
```bash
docker-compose down
```

To reset the database volume:
```bash
docker-compose down -v
```

---

### Option 2 — Local

**Prerequisites:** Node.js v18+, PostgreSQL running locally.

**1. Install dependencies**
```bash
npm install
```

**2. Set up the database**
```bash
psql -U postgres -c "CREATE DATABASE campusmarket;"
psql -U postgres -d campusmarket -f schema.sql
psql -U postgres -d campusmarket -f seed.sql
```

**3. Configure environment variables**

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

**4. Start the server**
```bash
npm start
```

---

## Running tests

Tests use Jest + Supertest and hit a real database, so make sure the DB is running and `.env` is configured.

```bash
npm test
```

Test files are in `tests/`:
- `auth.test.js` — register, login, invalid credentials
- `listings.test.js` — fetch, filter, create listings
- `watchlist.test.js` — add, view, remove from watchlist

---

## API docs

Interactive Swagger UI: `http://localhost:3000/api-docs`

---

## API Endpoints

All protected endpoints require an `Authorization: Bearer <token>` header obtained from `POST /users/login`.

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

| ID | Name |
|----|------|
| 1 | Textbooks |
| 2 | Electronics |
| 3 | Furniture |
| 4 | Clothing |
| 5 | Sports |
| 6 | Music |
| 7 | Gaming |
| 8 | Appliances |
| 9 | Stationery |
| 10 | Other |
