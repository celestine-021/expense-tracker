import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { z } from 'zod'

const { Pool } = pg
const app = express()
const port = Number(process.env.PORT ?? 4000)
const databaseUrl = process.env.DATABASE_URL
const jwtSecret = process.env.JWT_SECRET

if (!databaseUrl) throw new Error('DATABASE_URL is required. Set it in your .env file.')
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET is required and must be at least 32 characters.')

const pool = new Pool({
  connectionString: databaseUrl,
  ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
})

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '20kb' }))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
})

const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase())
const passwordSchema = z.string().min(8).max(72)
const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
})
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(72) })
const transactionSchema = z.object({
  description: z.string().trim().min(2).max(120),
  amount: z.number().finite().positive().max(9999999999.99),
  type: z.enum(['income', 'expense']),
  category: z.string().trim().min(2).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }, 'Enter a valid calendar date.'),
})
const budgetSchema = z.object({
  monthlyLimit: z.number().finite().min(0).max(9999999999.99),
  currency: z.enum(['KES', 'USD', 'EUR', 'GBP']),
})

function issueToken(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d', issuer: 'pesatrack-api' })
}

function validate(schema, body) {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const error = new Error(parsed.error.issues[0]?.message ?? 'Invalid request.')
    error.status = 400
    throw error
  }
  return parsed.data
}

function requireAuth(req, res, next) {
  const header = req.get('authorization')
  const [scheme, token] = header?.split(' ') ?? []
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Please sign in to continue.' })
  try {
    const claims = jwt.verify(token, jwtSecret, { issuer: 'pesatrack-api' })
    if (typeof claims === 'string' || typeof claims.sub !== 'string') {
      return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' })
    }
    req.userId = claims.sub
    return next()
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = validate(registerSchema, req.body)
    const passwordHash = await bcrypt.hash(password, 12)
    const client = await pool.connect()
    let user
    try {
      await client.query('BEGIN')
      const result = await client.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
        [name, email, passwordHash],
      )
      user = result.rows[0]
      await client.query('INSERT INTO budgets (user_id) VALUES ($1)', [user.id])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' })
      throw error
    } finally {
      client.release()
    }
    return res.status(201).json({ token: issueToken(user), user })
  } catch (error) {
    return next(error)
  }
})

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = validate(loginSchema, req.body)
    const result = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email])
    const user = result.rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' })
    }
    return res.json({
      token: issueToken(user),
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (error) {
    return next(error)
  }
})

app.get('/api/dashboard', requireAuth, async (req, res, next) => {
  try {
    const [userResult, transactionsResult, budgetResult] = await Promise.all([
      pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]),
      pool.query(
        `SELECT id, description, amount, type, category, transaction_date::text AS date
         FROM transactions WHERE user_id = $1 ORDER BY transaction_date DESC, created_at DESC`,
        [req.userId],
      ),
      pool.query('SELECT monthly_limit, currency FROM budgets WHERE user_id = $1', [req.userId]),
    ])
    if (!userResult.rows[0]) return res.status(401).json({ error: 'Your account is no longer available.' })
    const budget = budgetResult.rows[0]
    return res.json({
      user: userResult.rows[0],
      transactions: transactionsResult.rows.map((item) => ({
        ...item,
        amount: Number(item.amount),
        date: item.date,
      })),
      budget: { monthlyLimit: Number(budget?.monthly_limit ?? 0), currency: budget?.currency ?? 'KES' },
    })
  } catch (error) {
    return next(error)
  }
})

app.post('/api/transactions', requireAuth, async (req, res, next) => {
  try {
    const item = validate(transactionSchema, req.body)
    const result = await pool.query(
      `INSERT INTO transactions (user_id, description, amount, type, category, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, description, amount, type, category, transaction_date::text AS date`,
      [req.userId, item.description, item.amount, item.type, item.category, item.date],
    )
    const transaction = result.rows[0]
    return res.status(201).json({
      transaction: { ...transaction, amount: Number(transaction.amount) },
    })
  } catch (error) {
    return next(error)
  }
})

app.delete('/api/transactions/:id', requireAuth, async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id)
    if (!id.success) return res.status(400).json({ error: 'Invalid transaction ID.' })
    const result = await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id.data, req.userId])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found.' })
    return res.status(204).end()
  } catch (error) {
    return next(error)
  }
})

app.put('/api/budget', requireAuth, async (req, res, next) => {
  try {
    const { monthlyLimit, currency } = validate(budgetSchema, req.body)
    const result = await pool.query(
      `INSERT INTO budgets (user_id, monthly_limit, currency) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit,
       currency = EXCLUDED.currency, updated_at = NOW()
       RETURNING monthly_limit, currency`,
      [req.userId, monthlyLimit, currency],
    )
    return res.json({ monthlyLimit: Number(result.rows[0].monthly_limit), currency: result.rows[0].currency })
  } catch (error) {
    return next(error)
  }
})

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Request body must be valid JSON.' })
  }
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500
  if (status === 500) console.error('API request failed:', error)
  return res.status(status).json({ error: status === 500 ? 'The server could not complete your request.' : error.message })
})

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url))
try {
  const schema = await readFile(schemaPath, 'utf8')
  await pool.query(schema)
} catch (error) {
  console.error('Could not initialize PostgreSQL schema. Check DATABASE_URL and database permissions.', error)
  process.exitCode = 1
  await pool.end()
  process.exit()
}

const server = app.listen(port, () => console.log(`PesaTrack API listening on http://localhost:${port}`))

async function shutdown(signal) {
  console.log(`${signal} received; closing PesaTrack API.`)
  server.close(async (error) => {
    await pool.end()
    if (error) {
      console.error('Error closing API server:', error)
      process.exitCode = 1
    }
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
