import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

type Transaction = {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  date: string
}

type Budget = {
  monthlyLimit: number
  currency: string
}

type User = {
  id: string
  name: string
  email: string
}

type DashboardData = {
  user: User
  transactions: Transaction[]
  budget: Budget
}

const EMPTY_TRANSACTIONS: Transaction[] = []
const API_URL = import.meta.env.VITE_API_URL ?? '/api'
const categories = ['Food & Drink', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Salary', 'Other']
const categoryColors: Record<string, string> = {
  'Food & Drink': '#9b8af7',
  Transport: '#f0a35e',
  Shopping: '#62b6a1',
  Bills: '#72a9e8',
  Entertainment: '#e782a9',
  Health: '#e5c15b',
  Salary: '#62b6a1',
  Other: '#aab0be',
}

class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const money = (amount: number, currency = 'KES') =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

function formatTransactionDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function request<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new Error(`Can’t reach the PesaTrack API at ${API_URL}. Start the app with npm run dev and check the API terminal for startup errors.`)
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(payload.error ?? 'Something went wrong. Please try again.', response.status)
  return payload as T
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('pesatrack-token'))
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [now] = useState(() => new Date())
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [activeNav, setActiveNav] = useState('Overview')
  const [modal, setModal] = useState<'transaction' | 'budget' | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('Last 6 months')

  const refresh = useCallback(async (sessionToken: string) => {
    setError('')
    try {
      const data = await request<DashboardData>('/dashboard', sessionToken)
      setDashboard(data)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setToken(null)
        localStorage.removeItem('pesatrack-token')
        setDashboard(null)
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to load your account.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    let active = true
    void (async () => {
      try {
        const data = await request<DashboardData>('/dashboard', token)
        if (active) setDashboard(data)
      } catch (requestError) {
        if (!active) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          setToken(null)
          localStorage.removeItem('pesatrack-token')
          setDashboard(null)
        }
        setError(requestError instanceof Error ? requestError.message : 'Unable to load your account.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [token])

  const transactions = dashboard?.transactions ?? EMPTY_TRANSACTIONS
  const monthTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const date = new Date(`${item.date}T12:00:00`)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })
  }, [now, transactions])
  const income = monthTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const expenses = monthTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const balance = transactions.reduce((sum, item) => sum + (item.type === 'income' ? item.amount : -item.amount), 0)
  const budget = dashboard?.budget.monthlyLimit ?? 0
  const budgetUsed = budget ? Math.min((expenses / budget) * 100, 100) : 0

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...transactions]
      .filter((item) => !query || `${item.description} ${item.category} ${item.type}`.toLowerCase().includes(query))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, search])

  const chartData = useMemo(() => {
    const monthCount = period === 'This month' ? 1 : 6
    return Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - monthCount + 1 + index, 1)
      const monthItems = transactions.filter((item) => {
        const itemDate = new Date(`${item.date}T12:00:00`)
        return itemDate.getMonth() === date.getMonth() && itemDate.getFullYear() === date.getFullYear()
      })
      return {
        month: date.toLocaleDateString('en', { month: 'short' }),
        income: monthItems.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0),
        expenses: monthItems.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0),
      }
    })
  }, [now, period, transactions])

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>()
    monthTransactions.filter((item) => item.type === 'expense').forEach((item) => {
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount)
    })
    return [...totals.entries()].map(([name, value]) => ({ name, value, color: categoryColors[name] ?? categoryColors.Other }))
  }, [monthTransactions])

  const logout = () => {
    localStorage.removeItem('pesatrack-token')
    setToken(null)
    setDashboard(null)
  }

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setError('')
    try {
      const result = await request<{ token: string }>('/auth/' + authMode, null, {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      })
      localStorage.setItem('pesatrack-token', result.token)
      setToken(result.token)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.')
      setLoading(false)
    }
  }

  const saveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    const form = new FormData(event.currentTarget)
    try {
      await request('/transactions', token, {
        method: 'POST',
        body: JSON.stringify({
          description: form.get('description'),
          amount: Number(form.get('amount')),
          type: form.get('type'),
          category: form.get('category'),
          date: form.get('date'),
        }),
      })
      setModal(null)
      setLoading(true)
      await refresh(token)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save transaction.')
    }
  }

  const saveBudget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    const form = new FormData(event.currentTarget)
    try {
      await request('/budget', token, {
        method: 'PUT',
        body: JSON.stringify({ monthlyLimit: Number(form.get('monthlyLimit')), currency: form.get('currency') }),
      })
      setModal(null)
      setLoading(true)
      await refresh(token)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save budget.')
    }
  }

  const deleteTransaction = async (id: string) => {
    if (!token || !window.confirm('Delete this transaction? This cannot be undone.')) return
    try {
      await request(`/transactions/${id}`, token, { method: 'DELETE' })
      setLoading(true)
      await refresh(token)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete transaction.')
    }
  }

  if (token && !dashboard) {
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="brand-icon"><Wallet size={19} /></span>
          <h1>{loading ? 'Getting your money in focus…' : 'We couldn’t load your account.'}</h1>
          {error && <p role="alert">{error}</p>}
          {!loading && <div><button className="button button-primary" onClick={() => { setError(''); setLoading(true); void refresh(token) }}>Try again</button><button className="text-button" onClick={logout}>Sign out</button></div>}
        </div>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="auth-page">
        <div className="auth-art">
          <div className="auth-brand"><span className="brand-icon"><Wallet size={19} /></span> pesa<span>track</span></div>
          <div className="auth-message">
            <span className="eyebrow"><span className="eyebrow-dot" /> YOUR MONEY, IN FOCUS</span>
            <h1>Small steps.<br />Big <em>financial</em><br />confidence.</h1>
            <p>A clearer picture of your money starts with a single step. Let’s make it count.</p>
            <div className="auth-quote"><div className="quote-stars">★★★★★</div><p>“Finally, money management that feels simple and actually makes sense.”</p><div className="quote-person"><span className="avatar avatar-peach">JM</span><span><b>Joy M.</b><small>PesaTrack member</small></span></div></div>
          </div>
          <span className="auth-copyright">© 2025 PesaTrack. Your money, your move.</span>
        </div>
        <div className="auth-form-side">
          <div className="auth-topline">New to PesaTrack? <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError('') }}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></div>
          <form className="auth-form" onSubmit={handleAuth}>
            <span className="eyebrow">{authMode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</span>
            <h2>{authMode === 'login' ? 'Good to see you.' : 'Make room to grow.'}</h2>
            <p className="form-subtitle">{authMode === 'login' ? 'Sign in to pick up where you left off.' : 'Create your free account and take control.'}</p>
            {authMode === 'register' && <label>Full name<input name="name" placeholder="e.g. Alex Morgan" autoComplete="name" required minLength={2} /></label>}
            <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
            <label>Password<input name="password" type="password" placeholder="At least 8 characters" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required minLength={8} /></label>
            {error && <div className="error-banner" role="alert">{error}</div>}
            <button className="button button-primary auth-submit" disabled={loading}>{loading ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></button>
            <div className="auth-secure"><span><Check size={14} /></span> Your financial data is private and encrypted</div>
          </form>
        </div>
      </main>
    )
  }

  if (!dashboard) {
    return <main className="session-loading"><div className="session-loading-card"><span className="brand-icon"><Wallet size={19} /></span><h1>Your account is unavailable.</h1><button className="button button-primary" onClick={logout}>Sign out</button></div></main>
  }

  const navItems = [
    { title: 'Overview', icon: LayoutDashboard },
    { title: 'Transactions', icon: ArrowLeftRight },
    { title: 'Budgets', icon: Target },
    { title: 'Reports', icon: TrendingUp },
  ]

  return (
    <div className="app-shell">
      {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-icon"><Wallet size={19} /></span> pesa<span>track</span></div>
        <span className="side-label">MENU</span>
        <nav className="side-nav">
          {navItems.map(({ title, icon: Icon }) => (
            <button key={title} className={activeNav === title ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveNav(title); setMobileNav(false) }}>
              <Icon size={18} strokeWidth={1.8} /><span>{title}</span>{title === 'Transactions' && <span className="nav-count">{transactions.length}</span>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="upgrade-card"><span className="upgrade-spark">✦</span><b>Money goals, made easier.</b><p>Build habits that move you forward.</p><button onClick={() => { setActiveNav('Budgets'); setMobileNav(false) }}>Explore budgets <ArrowRight size={14} /></button></div>
          <button className="nav-item"><CircleHelp size={18} strokeWidth={1.8} /><span>Help & support</span></button>
          <button className="nav-item" onClick={logout}><LogOut size={18} strokeWidth={1.8} /><span>Sign out</span></button>
          <div className="profile"><span className="avatar avatar-lilac">{dashboard.user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="profile-name"><b>{dashboard.user.name}</b><small>Personal account</small></span><ChevronDown size={16} className="profile-chevron" /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumb">Pages <span>/</span> <b>{activeNav}</b></div>
          <div className="topbar-actions"><div className="topbar-date"><CalendarDays size={16} /> {now.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</div><button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button></div>
        </header>

        <div className="page-content">
          {error && <div className="error-banner page-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
          <div className="welcome-row"><div><span className="eyebrow">YOUR FINANCIAL SNAPSHOT</span><h1>{activeNav === 'Overview' ? <>Good morning, {dashboard.user.name.split(' ')[0]} <span className="wave">✦</span></> : activeNav}</h1><p className="welcome-subtitle">Here’s what’s happening with your money.</p></div><button className="button button-primary" onClick={() => setModal('transaction')}><Plus size={17} /> Add transaction</button></div>

          {loading && <div className="loading-bar" aria-label="Loading" />}

          {activeNav === 'Overview' && <>
            <section className="summary-grid">
              <article className="summary-card balance-card"><div className="card-heading"><span>Total balance</span><span className="summary-icon balance-icon"><Wallet size={18} /></span></div><div className="summary-amount">{money(balance, dashboard.budget.currency)}</div><div className="summary-foot"><span className="trend-positive"><TrendingUp size={14} /> Your net total</span><span>all time</span></div></article>
              <article className="summary-card"><div className="card-heading"><span>Income</span><span className="summary-icon income-icon"><ArrowDownLeft size={18} /></span></div><div className="summary-amount">{money(income, dashboard.budget.currency)}</div><div className="summary-foot"><span className="trend-positive"><ArrowDownLeft size={13} /> Money in</span><span>this month</span></div></article>
              <article className="summary-card"><div className="card-heading"><span>Expenses</span><span className="summary-icon expense-icon"><ArrowUpRight size={18} /></span></div><div className="summary-amount">{money(expenses, dashboard.budget.currency)}</div><div className="summary-foot"><span className="trend-neutral"><ArrowUpRight size={13} /> Money out</span><span>this month</span></div></article>
              <article className="summary-card"><div className="card-heading"><span>Monthly budget</span><span className="summary-icon budget-icon"><Target size={18} /></span></div><div className="summary-amount">{money(budget, dashboard.budget.currency)}</div><div className="budget-progress"><span style={{ width: `${budgetUsed}%` }} /></div><div className="summary-foot"><span>{money(Math.max(budget - expenses, 0), dashboard.budget.currency)} left</span><button className="text-button" onClick={() => setModal('budget')}>Edit budget</button></div></article>
            </section>

            <section className="charts-grid">
              <article className="panel trend-panel"><div className="panel-heading"><div><h2>Money flow</h2><p>Income and expenses over time</p></div><button className="select-button" onClick={() => setPeriod(period === 'This month' ? 'Last 6 months' : 'This month')}>{period}<ChevronDown size={15} /></button></div><div className="chart-legend"><span><i className="legend-dot income-dot" /> Income</span><span><i className="legend-dot expense-dot" /> Expenses</span></div><div className="area-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 6, left: -14, bottom: 0 }}><defs><linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#69b7a3" stopOpacity={0.19} /><stop offset="95%" stopColor="#69b7a3" stopOpacity={0} /></linearGradient><linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a192ed" stopOpacity={0.18} /><stop offset="95%" stopColor="#a192ed" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#f0f0f4" strokeDasharray="4 6" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9a9ba8', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9a9ba8', fontSize: 10 }} tickFormatter={(value: number) => value === 0 ? '0' : `${Math.round(value / 1000)}k`} /><Tooltip formatter={(value) => money(Number(value), dashboard.budget.currency)} contentStyle={{ border: '1px solid #eeedf3', borderRadius: 12, boxShadow: '0 8px 24px #29204412', fontSize: 12 }} /><Area type="monotone" dataKey="income" stroke="#62b29f" strokeWidth={2.2} fill="url(#incomeGradient)" /><Area type="monotone" dataKey="expenses" stroke="#9583e6" strokeWidth={2.2} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></div></article>
              <article className="panel spending-panel"><div className="panel-heading"><div><h2>Where it goes</h2><p>Your spending by category</p></div><button className="icon-button subtle-icon" aria-label="Category spending"><Settings size={17} /></button></div>{categoryData.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={83} paddingAngle={4} stroke="none" cornerRadius={4}>{categoryData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => money(Number(value), dashboard.budget.currency)} contentStyle={{ border: '1px solid #eeedf3', borderRadius: 12, fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="donut-center"><b>{money(expenses, dashboard.budget.currency)}</b><small>total spent</small></div></div><div className="category-legend">{categoryData.slice(0, 4).map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><b>{money(item.value, dashboard.budget.currency)}</b></div>)}</div></> : <div className="empty-chart"><span className="empty-chart-icon"><CreditCard size={22} /></span><b>No spending just yet</b><span>Add an expense to see your breakdown.</span></div>}</article>
            </section>

            <TransactionsPanel transactions={filteredTransactions.slice(0, 5)} currency={dashboard.budget.currency} search={search} setSearch={setSearch} onViewAll={() => setActiveNav('Transactions')} onDelete={deleteTransaction} />
            <footer className="page-footer"><span>Made for better money days.</span><span><span className="footer-dot" /> All your finances, in one place</span></footer>
          </>}

          {activeNav === 'Transactions' && <section className="panel transactions-page"><TransactionsPanel transactions={filteredTransactions} currency={dashboard.budget.currency} search={search} setSearch={setSearch} onDelete={deleteTransaction} /></section>}

          {activeNav === 'Budgets' && <section className="panel budget-page"><div className="panel-heading"><div><h2>Your monthly plan</h2><p>Stay intentional with your spending this month.</p></div><button className="button button-primary" onClick={() => setModal('budget')}><Settings size={16} /> Edit budget</button></div><div className="budget-overview"><div className="budget-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" /><circle className="budget-ring-progress" cx="60" cy="60" r="52" style={{ strokeDashoffset: `${327 - (327 * budgetUsed) / 100}` }} /></svg><div><b>{Math.round(budgetUsed)}%</b><small>used</small></div></div><div><span className="eyebrow">MONTHLY SPENDING LIMIT</span><h3>{money(budget, dashboard.budget.currency)}</h3><p>You’ve spent <b>{money(expenses, dashboard.budget.currency)}</b> and have <b>{money(Math.max(0, budget - expenses), dashboard.budget.currency)}</b> left this month.</p></div></div><div className="budget-categories"><h3>Spending by category</h3>{categoryData.length ? categoryData.map((item) => <div className="budget-category" key={item.name}><span className="category-color" style={{ background: item.color }} /><span className="budget-category-name">{item.name}</span><span className="budget-category-value">{money(item.value, dashboard.budget.currency)}</span><div className="category-track"><i style={{ width: `${Math.min((item.value / Math.max(budget, 1)) * 100, 100)}%`, background: item.color }} /></div></div>) : <p className="empty-message">No expenses recorded this month. Add a transaction to get started.</p>}</div></section>}

          {activeNav === 'Reports' && <><section className="charts-grid reports-charts"><article className="panel trend-panel"><div className="panel-heading"><div><h2>Income vs. expenses</h2><p>A six-month look at your money flow</p></div></div><div className="chart-legend"><span><i className="legend-dot income-dot" /> Income</span><span><i className="legend-dot expense-dot" /> Expenses</span></div><div className="area-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 6, left: -14, bottom: 0 }}><defs><linearGradient id="incomeGradientReport" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#69b7a3" stopOpacity={0.19} /><stop offset="95%" stopColor="#69b7a3" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#f0f0f4" strokeDasharray="4 6" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9a9ba8', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9a9ba8', fontSize: 10 }} tickFormatter={(value: number) => value === 0 ? '0' : `${Math.round(value / 1000)}k`} /><Tooltip formatter={(value) => money(Number(value), dashboard.budget.currency)} /><Area type="monotone" dataKey="income" stroke="#62b29f" strokeWidth={2.2} fill="url(#incomeGradientReport)" /><Area type="monotone" dataKey="expenses" stroke="#9583e6" strokeWidth={2.2} fill="none" /></AreaChart></ResponsiveContainer></div></article><article className="panel spending-panel"><div className="panel-heading"><div><h2>Spending mix</h2><p>This month by category</p></div></div>{categoryData.length ? <div className="report-category-list">{categoryData.map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><b>{money(item.value, dashboard.budget.currency)}</b></div>)}</div> : <div className="empty-chart"><span className="empty-chart-icon"><CreditCard size={22} /></span><b>No data yet</b><span>Record expenses to see your reports.</span></div>}</article></section><TransactionsPanel transactions={filteredTransactions} currency={dashboard.budget.currency} search={search} setSearch={setSearch} /></>}
        </div>
      </main>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{modal === 'transaction' ? 'KEEP YOUR LEDGER FRESH' : 'A PLAN THAT FEELS RIGHT'}</span>
                <h2 id="modal-title">{modal === 'transaction' ? 'Add a transaction' : 'Set your budget'}</h2>
              </div>
              <button className="icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><X size={19} /></button>
            </div>
            {modal === 'transaction' ? (
              <form onSubmit={saveTransaction} className="modal-form">
                <label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label>
                <label>Description<input name="description" placeholder="e.g. Lunch with friends" required minLength={2} maxLength={120} /></label>
                <div className="form-row">
                  <label>Amount<input name="amount" type="number" placeholder="0.00" min="0.01" step="0.01" required /></label>
                  <label>Category<select name="category">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                </div>
                <label>Date<input name="date" type="date" defaultValue={today} required /></label>
                <div className="modal-actions">
                  <button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button>
                  <button className="button button-primary"><Plus size={16} /> Save transaction</button>
                </div>
              </form>
            ) : (
              <form onSubmit={saveBudget} className="modal-form">
                <p className="budget-modal-copy">Pick a monthly spending target that helps you feel in control, not restricted.</p>
                <label>Monthly limit<input name="monthlyLimit" type="number" min="1" step="1" defaultValue={budget} required /></label>
                <label>Currency<select name="currency" defaultValue={dashboard.budget.currency}><option value="KES">KES — Kenyan Shilling</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — British Pound</option></select></label>
                <div className="modal-actions">
                  <button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button>
                  <button className="button button-primary"><Check size={16} /> Save budget</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function TransactionsPanel({ transactions, currency, search, setSearch, onViewAll, onDelete }: { transactions: Transaction[]; currency: string; search: string; setSearch: (value: string) => void; onViewAll?: () => void; onDelete?: (id: string) => void }) {
  const exportCsv = () => {
    const csv = [
      'Date,Description,Category,Type,Amount',
      ...transactions.map((item) => `${item.date},"${item.description.replaceAll('"', '""')}",${item.category},${item.type},${item.amount}`),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'pesatrack-transactions.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel transactions-panel">
      <div className="panel-heading transactions-heading">
        <div><h2>Recent transactions</h2><p>A little detail goes a long way.</p></div>
        <div className="transaction-tools">
          <label className="search-box">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." aria-label="Search transactions" />
            {search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
          </label>
          <button className="button button-outline" onClick={onViewAll ?? exportCsv}>
            {onViewAll ? <>View all <ArrowRight size={15} /></> : <><Download size={15} /> Export</>}
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>DATE</th><th>AMOUNT</th><th>TYPE</th>{onDelete && <th aria-label="Actions" />}</tr></thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id}>
                <td><div className="transaction-cell"><span className={`transaction-icon ${item.type === 'income' ? 'transaction-income' : ''}`}>{item.type === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><b>{item.description}</b></div></td>
                <td><span className="category-pill"><i style={{ background: categoryColors[item.category] ?? categoryColors.Other }} />{item.category}</span></td>
                <td className="transaction-date">{formatTransactionDate(item.date)}</td>
                <td className={item.type === 'income' ? 'amount-income' : 'amount-expense'}>{item.type === 'income' ? '+' : '−'}{money(item.amount, currency)}</td>
                <td><span className={`type-pill ${item.type}`}>{item.type}</span></td>
                {onDelete && <td><button className="delete-transaction" aria-label={`Delete ${item.description}`} title="Delete transaction" onClick={() => onDelete(item.id)}><Trash2 size={14} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && <div className="empty-table"><span className="empty-chart-icon"><ArrowLeftRight size={21} /></span><b>No transactions found</b><span>Try a different search or add your first transaction.</span></div>}
      </div>
    </section>
  )
}

export default App
