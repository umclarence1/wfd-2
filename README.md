# Wilberforce Data Service & SmartDeals Ghana

A modern, full-stack digital services platform for Ghana — data bundles, MTN AFA registration, and BECE/WASSCE result checkers.

## Tech Stack

**Frontend:** React (Vite), Tailwind CSS, React Router, TanStack Query, Framer Motion, Axios, Socket.IO

**Backend:** Node.js, Express, MongoDB/Mongoose, JWT Auth, Paystack, Nodemailer, mNotify, Cloudinary

## Features

- Premium mobile-first UI with dark/light mode
- Auto-playing hero slider with admin management
- Data bundle purchase (MTN, Telecel, AirtelTigo) with pill-style package selector
- MTN AFA registration with Ghana Card validation
- BECE/WASSCE checker delivery via email & SMS
- Paystack payments with 2% checkout fee (not included in package price)
- Phone/network validation with automatic network detection
- Order history via email OTP (no login required)
- Promo code system with duplicate prevention
- Real-time package availability via Socket.IO
- Full admin dashboard (analytics, packages, orders, checkers, promos, users, sliders, settings)
- Enterprise security (Helmet, CORS, CSRF, rate limiting, bcrypt, JWT rotation)

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
# Install root dependencies
npm install

# Install client & server dependencies
cd client && npm install
cd ../server && npm install
```

### Environment Setup

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your credentials

# Client (optional)
cp client/.env.example client/.env
```

### Seed Database

```bash
npm run seed
```

Default admin: `admin@wds.com` / `Admin@123456`

### Development

```bash
# Run both client and server
npm run dev

# Or separately
npm run dev:server  # http://localhost:5000
npm run dev:client  # http://localhost:5173
```

## Project Structure

```
wds/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── api/         # Axios client
│       ├── components/  # UI components
│       ├── context/     # Auth, Theme, Toast
│       ├── hooks/       # Socket.IO hook
│       ├── pages/       # Route pages
│       └── utils/       # Validation helpers
├── server/          # Express API
│   └── src/
│       ├── config/      # DB, env
│       ├── middleware/  # Auth, CSRF, rate limit
│       ├── models/      # Mongoose schemas
│       ├── routes/      # API routes
│       ├── services/    # Business logic
│       └── scripts/     # Seed script
└── package.json     # Root scripts
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/packages | List packages (no-cache) |
| POST | /api/orders/create | Create order & initialize payment |
| GET | /api/orders/verify/:ref | Verify Paystack payment |
| POST | /api/orders/history/request-otp | Request order history OTP |
| POST | /api/payments/webhook | Paystack webhook |
| GET | /api/admin/analytics | Admin analytics |

## Security

- JWT access tokens (15 min) + refresh token rotation
- HTTP-only secure cookies
- bcrypt password hashing
- Helmet, CORS allowlist, CSRF protection
- express-mongo-sanitize (NoSQL injection)
- Rate limiting on auth, OTP, and payment endpoints
- Paystack webhook signature verification
- Atomic checker assignment (prevents double sale)
- Package re-validation before payment & fulfillment

## License

Private — Wilberforce Data Service
