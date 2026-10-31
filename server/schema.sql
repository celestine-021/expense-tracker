CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description VARCHAR(120) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type VARCHAR(7) NOT NULL CHECK (type IN ('income', 'expense')),
  category VARCHAR(40) NOT NULL,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON transactions (user_id, transaction_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS budgets (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_limit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_limit >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
