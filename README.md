# PesaTrack

Track your money. Manage your spending. Take control of your finances.

PesaTrack is a personal finance dashboard built with React, TypeScript, Express, and PostgreSQL. Local development uses a persistent embedded PostgreSQL database, so no separate database installation or `.env` setup is required to create an account. Set `DATABASE_URL` to use an external PostgreSQL instance instead.

## Requirements

- Node.js 20.19+ or 22.12+

## Set up locally

1. Install dependencies and start the web app and API together:

   ```sh
   npm install
   npm run dev
   ```

2. Open [http://localhost:5173](http://localhost:5173), create an account, and add your first transaction.

The development command starts both the Vite frontend and Express API; Vite proxies `/api` requests to the API. The embedded PostgreSQL database is stored in the ignored `data/` directory and persists across restarts. To use a regular PostgreSQL server, create a database, set `DATABASE_URL` in `.env`, and start the same command. The API creates the required tables and index at startup; its database user needs permission to create them. The API listens on port `4000` by default.

For production, set `NODE_ENV=production`, `DATABASE_URL`, and a strong private `JWT_SECRET` of at least 32 characters. Serve the frontend over HTTPS and set `DATABASE_SSL=true` when your PostgreSQL provider requires verified TLS.

## Useful commands

- `npm run dev` — start the Vite frontend and API together
- `npm run dev:web` — start only the Vite frontend
- `npm run dev:api` — start the API with Node watch mode
- `npm run dev:all` — alias for `npm run dev`
- `npm run build` — type-check and create the production frontend bundle
- `npm run lint` — run Oxlint
- `npm run start:api` — start the API

## API

- `POST /api/auth/register` and `POST /api/auth/login` — create an account or sign in
- `GET /api/dashboard` — authenticated profile, transactions, and budget
- `POST /api/transactions` and `DELETE /api/transactions/:id` — create or remove a transaction
- `PUT /api/budget` — set the monthly spending limit and currency
- `GET /api/health` — API health check

All financial records are scoped to their authenticated owner. Passwords are hashed, API inputs are validated, and sign-in endpoints are rate-limited.
