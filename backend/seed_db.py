"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  StockIQ — Database Seed Script                                             ║
║                                                                              ║
║  Populates the SQLite database with realistic data for demo / evaluation:   ║
║    • 4 demo users with hashed passwords                                      ║
║    • 500–2000 buy/sell transactions per user (spread over the past year)     ║
║    • 365 days of portfolio_history for each user                             ║
║    • Watchlist entries and risk snapshots                                    ║
║    • Simulation history                                                      ║
║                                                                              ║
║  Run AFTER starting the FastAPI app (it creates the tables via init_db):    ║
║      python seed_db.py                                                       ║
║                                                                              ║
║  Or run standalone (creates tables itself if db doesn't exist):             ║
║      python seed_db.py --standalone                                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import sqlite3
import random
import uuid
import sys
import os
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH   = "stockiq.db"
pwd_ctx   = CryptContext(schemes=["bcrypt"], deprecated="auto")
SEED      = 42          # reproducible random data
random.seed(SEED)

# ── NSE stock master (mirrors STOCKS constant in StockIQ-Complete.jsx) ────────
STOCKS = {
    # IT
    "TCS.NS"       : {"sector": "IT",             "base": 3921.0},
    "INFY.NS"      : {"sector": "IT",             "base": 1432.8},
    "HCLTECH.NS"   : {"sector": "IT",             "base": 1623.4},
    "WIPRO.NS"     : {"sector": "IT",             "base":  456.9},
    "TECHM.NS"     : {"sector": "IT",             "base": 1532.4},
    "MPHASIS.NS"   : {"sector": "IT",             "base": 2312.0},
    "LTTS.NS"      : {"sector": "IT",             "base": 4890.0},
    # Banking
    "HDFCBANK.NS"  : {"sector": "Banking",        "base": 1654.3},
    "ICICIBANK.NS" : {"sector": "Banking",        "base": 1089.6},
    "SBIN.NS"      : {"sector": "Banking",        "base":  812.4},
    "AXISBANK.NS"  : {"sector": "Banking",        "base": 1134.2},
    "KOTAK.NS"     : {"sector": "Banking",        "base": 1876.5},
    "INDUSINDBK.NS": {"sector": "Banking",        "base": 1045.6},
    # NBFC
    "BAJFINANCE.NS": {"sector": "NBFC",           "base": 6847.2},
    "BAJAJFINSV.NS": {"sector": "NBFC",           "base": 1621.0},
    "CHOLAFIN.NS"  : {"sector": "NBFC",           "base": 1234.0},
    # Energy
    "RELIANCE.NS"  : {"sector": "Energy",         "base": 2847.5},
    "ONGC.NS"      : {"sector": "Energy",         "base":  278.3},
    "IOC.NS"       : {"sector": "Energy",         "base":  168.2},
    "BPCL.NS"      : {"sector": "Energy",         "base":  312.8},
    # FMCG
    "HINDUNILVR.NS": {"sector": "FMCG",           "base": 2634.1},
    "NESTLEIND.NS" : {"sector": "FMCG",           "base": 2341.6},
    "DABUR.NS"     : {"sector": "FMCG",           "base":  524.8},
    "MARICO.NS"    : {"sector": "FMCG",           "base":  612.4},
    "BRITANNIA.NS" : {"sector": "FMCG",           "base": 5124.0},
    "ITC.NS"       : {"sector": "FMCG",           "base":  468.2},
    "TATACONSUM.NS": {"sector": "FMCG",           "base": 1082.0},
    "GODREJCP.NS"  : {"sector": "FMCG",           "base": 1234.0},
    # Pharma
    "SUNPHARMA.NS" : {"sector": "Pharma",         "base": 1678.4},
    "DRREDDYS.NS"  : {"sector": "Pharma",         "base": 5892.0},
    "CIPLA.NS"     : {"sector": "Pharma",         "base": 1512.6},
    "DIVISLAB.NS"  : {"sector": "Pharma",         "base": 4823.1},
    "AUROPHARMA.NS": {"sector": "Pharma",         "base": 1082.0},
    # Healthcare
    "APOLLOHOSP.NS": {"sector": "Healthcare",     "base": 6812.0},
    # Auto
    "MARUTI.NS"    : {"sector": "Auto",           "base":11240.0},
    "TATAMOTORS.NS": {"sector": "Auto",           "base":  934.6},
    "M&M.NS"       : {"sector": "Auto",           "base": 2124.0},
    "BAJAJ-AUTO.NS": {"sector": "Auto",           "base": 8234.0},
    "HEROMOTOCO.NS": {"sector": "Auto",           "base": 4312.0},
    "EICHERMOT.NS" : {"sector": "Auto",           "base": 4612.0},
    # Consumer
    "TITAN.NS"     : {"sector": "Consumer",       "base": 3467.8},
    "ASIANPAINT.NS": {"sector": "Consumer",       "base": 2891.5},
    "PAGEIND.NS"   : {"sector": "Consumer",       "base":43280.0},
    "PIDILITIND.NS": {"sector": "Consumer",       "base": 2876.0},
    "HAVELLS.NS"   : {"sector": "Consumer",       "base": 1628.0},
    # Retail
    "DMART.NS"     : {"sector": "Retail",         "base": 3812.0},
    # Infrastructure
    "LT.NS"        : {"sector": "Infrastructure", "base": 3512.0},
    "ABB.NS"       : {"sector": "Infrastructure", "base": 6234.0},
    "SIEMENS.NS"   : {"sector": "Infrastructure", "base": 7124.0},
    # Cement
    "ULTRACEMCO.NS": {"sector": "Cement",         "base":10234.0},
    "SHREECEM.NS"  : {"sector": "Cement",         "base":26800.0},
    # Utilities
    "POWERGRID.NS" : {"sector": "Utilities",      "base":  312.4},
    "NTPC.NS"      : {"sector": "Utilities",      "base":  378.9},
    "TATAPOWER.NS" : {"sector": "Utilities",      "base":  384.0},
    "ADANIGREEN.NS": {"sector": "Utilities",      "base": 1724.0},
    # Metals
    "JSWSTEEL.NS"  : {"sector": "Metals",         "base":  912.3},
    "TATASTEEL.NS" : {"sector": "Metals",         "base":  168.4},
    "HINDALCO.NS"  : {"sector": "Metals",         "base":  634.8},
    "COALINDIA.NS" : {"sector": "Metals",         "base":  462.4},
    # Conglomerate
    "ADANIENT.NS"  : {"sector": "Conglomerate",   "base": 2456.8},
}

SYMBOLS = list(STOCKS.keys())

# ── Demo users ────────────────────────────────────────────────────────────────
# Each user gets a different portfolio style to create varied data
DEMO_USERS = [
    {
        "username":  "demo_user",
        "email":     "demo@stockiq.in",
        "password":  "demo123",
        "style":     "balanced",       # spread across many sectors
        "num_stocks": 12,
        "txn_count":  800,             # ~800 buy/sell events over the year
    },
    {
        "username":  "alpha_trader",
        "email":     "alpha@stockiq.in",
        "password":  "alpha123",
        "style":     "aggressive",     # concentrated IT + Banking
        "num_stocks": 6,
        "txn_count":  1500,            # active trader
    },
    {
        "username":  "conservative_inv",
        "email":     "conservative@stockiq.in",
        "password":  "cons123",
        "style":     "defensive",      # Pharma + FMCG + Utilities
        "num_stocks": 8,
        "txn_count":  350,             # buy-and-hold
    },
    {
        "username":  "sector_rotator",
        "email":     "sector@stockiq.in",
        "password":  "sector123",
        "style":     "rotation",       # rotates across sectors each quarter
        "num_stocks": 10,
        "txn_count":  1200,
    },
]

# Sector preferences per style
STYLE_SECTORS = {
    "balanced":   None,   # no filter — all sectors
    "aggressive": ["IT", "Banking", "NBFC", "Auto"],
    "defensive":  ["Pharma", "FMCG", "Utilities", "Consumer"],
    "rotation":   ["Energy", "Metals", "Infrastructure", "Cement", "Conglomerate"],
}


# ── Helpers ───────────────────────────────────────────────────────────────────
def gen_id():
    return str(uuid.uuid4())[:8]


def rand_price(base, drift=0.0, volatility=0.15):
    """Return a realistic price around base with drift and volatility."""
    change = random.gauss(drift, volatility)
    return round(base * (1 + change), 2)


def date_range(days_back=365):
    """Yield (date_str, datetime) for each day over the past `days_back` days."""
    today = datetime.now(timezone.utc).date()
    for i in range(days_back, -1, -1):
        d = today - timedelta(days=i)
        yield str(d), datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def pick_symbols(style, n):
    """Pick n symbols matching the given style preference."""
    preferred_sectors = STYLE_SECTORS.get(style)
    if preferred_sectors:
        pool = [s for s, info in STOCKS.items() if info["sector"] in preferred_sectors]
    else:
        pool = SYMBOLS[:]
    random.shuffle(pool)
    return pool[:n] if len(pool) >= n else pool + random.sample(
        [s for s in SYMBOLS if s not in pool], max(0, n - len(pool))
    )


# ── Standalone table creation (if FastAPI hasn't run yet) ─────────────────────
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY, email TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS portfolio (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    symbol TEXT NOT NULL, qty INTEGER NOT NULL CHECK (qty >= 0),
    avg_price REAL NOT NULL CHECK (avg_price > 0),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (username, symbol)
);
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy','sell')),
    qty INTEGER NOT NULL CHECK (qty > 0),
    price REAL NOT NULL CHECK (price > 0),
    total REAL GENERATED ALWAYS AS (qty * price) STORED,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS portfolio_history (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    date TEXT NOT NULL, value REAL NOT NULL,
    PRIMARY KEY (username, date)
);
CREATE TABLE IF NOT EXISTS watchlist (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (username, symbol)
);
CREATE TABLE IF NOT EXISTS simulations (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    symbol TEXT NOT NULL, amount REAL NOT NULL, qty INTEGER NOT NULL,
    price REAL NOT NULL, before_score INTEGER NOT NULL, after_score INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS risk_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('Low','Medium','High')),
    holdings INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_txn_username  ON transactions(username);
CREATE INDEX IF NOT EXISTS idx_txn_symbol    ON transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_port_username ON portfolio(username);
CREATE INDEX IF NOT EXISTS idx_hist_username ON portfolio_history(username);
"""


# ── Core seed function ────────────────────────────────────────────────────────
def seed_user(conn, user_cfg):
    username  = user_cfg["username"]
    style     = user_cfg["style"]
    txn_count = user_cfg["txn_count"]
    n_stocks  = user_cfg["num_stocks"]

    print(f"  Seeding {username!r} ({style}, {txn_count} transactions)...")

    # ── 1. Insert user ────────────────────────────────────────────────────────
    existing = conn.execute(
        "SELECT 1 FROM users WHERE username=?", (username,)
    ).fetchone()
    if existing:
        print(f"    User {username!r} already exists — skipping.")
        return

    conn.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?,?,?)",
        (username, user_cfg["email"], pwd_ctx.hash(user_cfg["password"])),
    )

    # ── 2. Choose stock universe for this user ────────────────────────────────
    universe = pick_symbols(style, n_stocks)

    # ── 3. Generate transactions spread over 365 days ─────────────────────────
    # We simulate a realistic pattern:
    #  - More buys than sells (net accumulation)
    #  - Buys clustered in groups (DCA behaviour)
    #  - Occasional sell events (~20% of trades)
    all_dates = [d for d, _ in date_range(365)]
    portfolio_state = {}   # symbol -> {qty, avg_price}

    txn_rows = []
    sell_ratio = 0.20      # 20% of trades are sells

    for _ in range(txn_count):
        symbol = random.choice(universe)
        base   = STOCKS[symbol]["base"]
        # Random date in the past year, with slight recency bias
        day_idx = int(random.triangular(0, 364, 280))
        date_str = all_dates[day_idx]
        ts = f"{date_str}T{random.randint(9,15):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}+05:30"

        price = rand_price(base, drift=0.0002, volatility=0.03)
        price = max(price, 1.0)

        # Decide buy or sell
        holding = portfolio_state.get(symbol)
        can_sell = holding and holding["qty"] >= 5
        is_sell  = can_sell and (random.random() < sell_ratio)

        if is_sell:
            sell_qty = random.randint(1, min(holding["qty"], 20))
            txn_rows.append((gen_id(), username, symbol, "sell", sell_qty, price, ts))
            portfolio_state[symbol]["qty"] -= sell_qty
            if portfolio_state[symbol]["qty"] == 0:
                del portfolio_state[symbol]
        else:
            buy_qty = random.randint(1, 25)
            txn_rows.append((gen_id(), username, symbol, "buy", buy_qty, price, ts))
            if symbol in portfolio_state:
                old = portfolio_state[symbol]
                new_qty = old["qty"] + buy_qty
                new_avg = (old["avg_price"] * old["qty"] + price * buy_qty) / new_qty
                portfolio_state[symbol] = {"qty": new_qty, "avg_price": new_avg}
            else:
                portfolio_state[symbol] = {"qty": buy_qty, "avg_price": price}

    # Bulk insert transactions
    conn.executemany(
        "INSERT OR IGNORE INTO transactions (id, username, symbol, type, qty, price, created_at) "
        "VALUES (?,?,?,?,?,?,?)",
        txn_rows,
    )
    print(f"    Inserted {len(txn_rows)} transactions.")

    # ── 4. Write final portfolio state ────────────────────────────────────────
    for symbol, state in portfolio_state.items():
        if state["qty"] > 0:
            conn.execute(
                "INSERT OR REPLACE INTO portfolio (username, symbol, qty, avg_price) VALUES (?,?,?,?)",
                (username, symbol, state["qty"], round(state["avg_price"], 2)),
            )
    print(f"    Portfolio: {len(portfolio_state)} holdings.")

    # ── 5. Generate 365 days of portfolio history ─────────────────────────────
    # Simulate a portfolio value that grows with noise — realistic NAV curve
    # We compute it by replaying the portfolio state day by day
    hist_rows = []
    running_portfolio = {}   # symbol -> qty at that point in time

    # Build a day-by-day snapshot by replaying sorted transactions
    sorted_txns = sorted(txn_rows, key=lambda r: r[6])  # sort by created_at
    txn_idx = 0
    total_txns = len(sorted_txns)

    for date_str, _ in date_range(365):
        # Apply all transactions up to this date
        while txn_idx < total_txns and sorted_txns[txn_idx][6][:10] <= date_str:
            t = sorted_txns[txn_idx]
            sym, ttype, qty = t[2], t[3], t[4]
            if ttype == "buy":
                running_portfolio[sym] = running_portfolio.get(sym, 0) + qty
            else:
                running_portfolio[sym] = max(0, running_portfolio.get(sym, 0) - qty)
            txn_idx += 1

        # Value = sum of qty * current_price (simulated with small noise)
        value = sum(
            qty * rand_price(STOCKS[sym]["base"], drift=0.0001, volatility=0.005)
            for sym, qty in running_portfolio.items()
            if qty > 0 and sym in STOCKS
        )
        if value > 0:
            hist_rows.append((username, date_str, round(value, 2)))

    conn.executemany(
        "INSERT OR REPLACE INTO portfolio_history (username, date, value) VALUES (?,?,?)",
        hist_rows,
    )
    print(f"    History: {len(hist_rows)} daily snapshots.")

    # ── 6. Watchlist — 3–6 random stocks not in portfolio ────────────────────
    held = set(portfolio_state.keys())
    watch_pool = [s for s in SYMBOLS if s not in held]
    random.shuffle(watch_pool)
    watch_count = random.randint(3, 6)
    for sym in watch_pool[:watch_count]:
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (username, symbol) VALUES (?,?)",
            (username, sym),
        )
    print(f"    Watchlist: {watch_count} symbols.")

    # ── 7. Risk snapshots — one per month for the past year ──────────────────
    risk_rows = []
    for i in range(12):
        snap_date = datetime.now(timezone.utc) - timedelta(days=30 * i)
        n_holdings = len(portfolio_state)
        score = random.randint(25, 75)
        level = "High" if score >= 70 else "Medium" if score >= 40 else "Low"
        risk_rows.append((
            username, score, level, n_holdings,
            snap_date.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
        ))
    conn.executemany(
        "INSERT INTO risk_snapshots (username, score, level, holdings, created_at) VALUES (?,?,?,?,?)",
        risk_rows,
    )

    # ── 8. Simulations — 10–20 saved simulations ─────────────────────────────
    sim_rows = []
    for _ in range(random.randint(10, 20)):
        sym   = random.choice(SYMBOLS)
        price = rand_price(STOCKS[sym]["base"])
        amt   = random.choice([10000, 25000, 50000, 100000])
        qty   = max(1, int(amt / price))
        before_score = random.randint(30, 80)
        after_score  = max(10, before_score + random.randint(-15, 5))
        sim_date = (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 180))).isoformat()
        sim_rows.append((gen_id(), username, sym, amt, qty, price, before_score, after_score, sim_date))
    conn.executemany(
        "INSERT OR IGNORE INTO simulations "
        "(id, username, symbol, amount, qty, price, before_score, after_score, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        sim_rows,
    )
    print(f"    Simulations: {len(sim_rows)} entries. Risk snapshots: 12 entries.")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    standalone = "--standalone" in sys.argv

    if not os.path.exists(DB_PATH) or standalone:
        print(f"Creating / verifying schema in {DB_PATH!r}...")

    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA_SQL)
    conn.commit()

    print(f"\nSeeding StockIQ database: {os.path.abspath(DB_PATH)}")
    print(f"Users to seed: {len(DEMO_USERS)}\n")

    for user_cfg in DEMO_USERS:
        seed_user(conn, user_cfg)
        conn.commit()

    # ── Summary stats ─────────────────────────────────────────────────────────
    print("\n" + "─" * 60)
    print("SEED COMPLETE — Row counts per table:")
    for table in ["users", "portfolio", "transactions", "portfolio_history",
                  "watchlist", "simulations", "risk_snapshots"]:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table:<22} {count:>6} rows")
    print("─" * 60)

    conn.close()
    print("\nDone! Start the API with:  uvicorn backend_app:app --reload --port 8000")
    print("Login credentials:")
    for u in DEMO_USERS:
        print(f"  username: {u['username']:<22} password: {u['password']}")


if __name__ == "__main__":
    main()
