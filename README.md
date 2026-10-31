# PesaTrack

Track your money. Manage your spending. Take control of your finances.

PesaTrack is a personal finance dashboard built with React, TypeScript, Express, and PostgreSQL. It includes account registration and sign-in, transaction tracking, monthly budgets, spending charts, transaction search, and CSV export.

## Requirements

- Node.js 20.19+ or 22.12+
- PostgreSQL 13+

## Set up locally

1. Create a PostgreSQL database, for example `pesatrack`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection string. Replace `JWT_SECRET` with a unique random value of at least 32 characters.
3. Install dependencies and start both the web app and API:

   ```sh
   npm install
   npm run dev:all
   ```

4. Open [http://localhost:5173](http://localhost:5173), create an account, and add your first transaction.

The API creates the required tables and index when it starts. The PostgreSQL user in `DATABASE_URL` needs permission to create tables and indexes in the selected database. The API listens on port `4000` by default; `PORT`, `CLIENT_URL`, and `VITE_API_URL` can be set in `.env` if needed.

For production, set `NODE_ENV=production`, use a strong private `JWT_SECRET`, serve the frontend over HTTPS, and set `DATABASE_SSL=true` when your PostgreSQL provider requires verified TLS.

## Useful commands

- `npm run dev` — start the Vite frontend
- `npm run dev:api` — start the API with Node watch mode
- `npm run dev:all` — start both services
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
