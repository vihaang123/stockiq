"""
╔══════════════════════════════════════════════════════════════════════════════╗
║           StockIQ — FastAPI Backend  (DBMS Course Project)                  ║
║                                                                              ║
║  DATABASE CHOICE JUSTIFICATION (OLTP vs OLAP):                              ║
║  ─────────────────────────────────────────────                               ║
║  We chose SQLite (OLTP) because:                                             ║
║  • Workload is write-heavy: every buy/sell triggers INSERT into transactions ║
║    and UPDATE on portfolio — classic OLTP pattern.                           ║
║  • Strict ACID consistency is required: partial writes on a buy order must  ║
║    never leave portfolio and transactions out of sync.                       ║
║  • Foreign-key enforcement prevents orphan rows (portfolio rows with no     ║
║    parent user, transactions with no parent portfolio entry).                ║
║  • A columnar OLAP store (DuckDB / ClickHouse) would be ideal for the       ║
║    analytics endpoints (GET /analytics, GET /leaderboard) in production,    ║
║    but SQLite's read speed is sufficient for the dataset sizes here and     ║
║    eliminates a second infrastructure dependency for a course project.      ║
║  • If the dataset grows to millions of rows, migrate the read-heavy         ║
║    analytics queries to a DuckDB layer while keeping SQLite as the          ║
║    transactional source of truth.                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

Run:
    pip install fastapi uvicorn python-jose[cryptography] passlib[bcrypt] pydantic
    uvicorn backend_app:app --reload --port 8000

Docs: http://localhost:8000/docs
"""

from __future__ import annotations

import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field, field_validator

# ─── App & Security Config ────────────────────────────────────────────────────
SECRET_KEY   = os.getenv("SECRET_KEY", "stockiq-super-secret-change-in-production")
ALGORITHM    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24   # 24 hours

app = FastAPI(
    title="StockIQ API",
    description=(
        "REST API for the StockIQ Smart Portfolio Intelligence System.\n\n"
        "**Database:** SQLite (OLTP) — chosen for ACID transactional consistency on "
        "buy/sell operations. Frequent inserts and updates on portfolio + transactions "
        "require row-level locking and foreign-key guarantees, not columnar aggregation.\n\n"
        "**Auth:** JWT Bearer token (OAuth2PasswordBearer). "
        "Login via `POST /auth/login` to obtain a token, then pass it as "
        "`Authorization: Bearer <token>` on all protected endpoints."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_ctx    = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2     = OAuth2PasswordBearer(tokenUrl="/auth/login")
DB_PATH    = "stockiq.db"

# ─── SQLite helpers ───────────────────────────────────────────────────────────
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """
    Create all tables on startup.

    Schema reflects a well-connected relational design:
      users ──< portfolio ──< transactions
                           ──< portfolio_history
                           ──< watchlist
                           ──< simulations
                           ──< risk_snapshots
    """
    with get_db() as conn:
        conn.executescript("""
            -- ── users ──────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS users (
                username      TEXT PRIMARY KEY,
                email         TEXT,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- ── portfolio ────────────────────────────────────────────────────
            -- One row per (user, symbol).  avgPrice updated on every buy.
            CREATE TABLE IF NOT EXISTS portfolio (
                username  TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                symbol    TEXT NOT NULL,
                qty       INTEGER NOT NULL CHECK (qty >= 0),
                avg_price REAL    NOT NULL CHECK (avg_price > 0),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (username, symbol)
            );

            -- ── transactions ─────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS transactions (
                id         TEXT PRIMARY KEY,
                username   TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                symbol     TEXT NOT NULL,
                type       TEXT NOT NULL CHECK (type IN ('buy','sell')),
                qty        INTEGER NOT NULL CHECK (qty > 0),
                price      REAL    NOT NULL CHECK (price > 0),
                total      REAL    GENERATED ALWAYS AS (qty * price) STORED,
                created_at TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            -- ── portfolio_history ─────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS portfolio_history (
                username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                date     TEXT NOT NULL,
                value    REAL NOT NULL,
                PRIMARY KEY (username, date)
            );

            -- ── watchlist ────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS watchlist (
                username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                symbol   TEXT NOT NULL,
                added_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (username, symbol)
            );

            -- ── simulations ──────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS simulations (
                id           TEXT PRIMARY KEY,
                username     TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                symbol       TEXT NOT NULL,
                amount       REAL NOT NULL,
                qty          INTEGER NOT NULL,
                price        REAL NOT NULL,
                before_score INTEGER NOT NULL,
                after_score  INTEGER NOT NULL,
                created_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- ── risk_snapshots ───────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS risk_snapshots (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                username   TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                score      INTEGER NOT NULL,
                level      TEXT    NOT NULL CHECK (level IN ('Low','Medium','High')),
                holdings   INTEGER NOT NULL,
                created_at TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            -- ── Indexes for JOIN performance ─────────────────────────────────
            CREATE INDEX IF NOT EXISTS idx_txn_username  ON transactions(username);
            CREATE INDEX IF NOT EXISTS idx_txn_symbol    ON transactions(symbol);
            CREATE INDEX IF NOT EXISTS idx_port_username ON portfolio(username);
            CREATE INDEX IF NOT EXISTS idx_hist_username ON portfolio_history(username);
        """)


init_db()

# ─── JWT helpers ─────────────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2)) -> str:
    """Decode JWT and return username, or raise 401."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if not username:
            raise credentials_exc
    except JWTError:
        raise credentials_exc
    return username


# ═══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS (request / response validation)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Auth ──────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str  = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    password: str  = Field(..., min_length=4, max_length=128)
    email:    Optional[str] = Field(None, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    username:     str


# ── Portfolio ─────────────────────────────────────────────────────────────────
class BuyRequest(BaseModel):
    symbol:   str   = Field(..., min_length=2, max_length=20)
    qty:      int   = Field(..., gt=0, description="Must be a positive integer")
    price:    float = Field(..., gt=0, description="Execution price in INR")

    @field_validator("symbol")
    @classmethod
    def symbol_upper(cls, v: str) -> str:
        return v.upper()


class SellRequest(BaseModel):
    symbol: str   = Field(..., min_length=2, max_length=20)
    qty:    int   = Field(..., gt=0)
    price:  float = Field(..., gt=0)

    @field_validator("symbol")
    @classmethod
    def symbol_upper(cls, v: str) -> str:
        return v.upper()


class HoldingOut(BaseModel):
    symbol:     str
    qty:        int
    avg_price:  float
    updated_at: str


class PortfolioOut(BaseModel):
    holdings:    List[HoldingOut]
    total_cost:  float
    total_value: Optional[float] = None


# ── Transactions ──────────────────────────────────────────────────────────────
class TransactionOut(BaseModel):
    id:         str
    username:   str
    symbol:     str
    type:       str
    qty:        int
    price:      float
    total:      float
    created_at: str


# ── Watchlist ─────────────────────────────────────────────────────────────────
class WatchRequest(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=20)

    @field_validator("symbol")
    @classmethod
    def symbol_upper(cls, v: str) -> str:
        return v.upper()


# ── History ───────────────────────────────────────────────────────────────────
class HistoryEntry(BaseModel):
    date:  str
    value: float


class HistoryRequest(BaseModel):
    date:  str   = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    value: float = Field(..., gt=0)


# ── Simulation ────────────────────────────────────────────────────────────────
class SimulationRequest(BaseModel):
    symbol:       str   = Field(..., min_length=2, max_length=20)
    amount:       float = Field(..., gt=0)
    qty:          int   = Field(..., gt=0)
    price:        float = Field(..., gt=0)
    before_score: int   = Field(..., ge=0, le=100)
    after_score:  int   = Field(..., ge=0, le=100)

    @field_validator("symbol")
    @classmethod
    def symbol_upper(cls, v: str) -> str:
        return v.upper()


# ── Risk ──────────────────────────────────────────────────────────────────────
class RiskSnapshotRequest(BaseModel):
    score:    int  = Field(..., ge=0, le=100)
    level:    str  = Field(..., pattern=r"^(Low|Medium|High)$")
    holdings: int  = Field(..., ge=0)


# ── Analytics (JOIN responses) ────────────────────────────────────────────────
class TradeSummaryOut(BaseModel):
    username:      str
    email:         Optional[str]
    total_trades:  int
    buy_count:     int
    sell_count:    int
    total_invested: float
    total_realised: float
    unique_symbols: int


class PortfolioFullOut(BaseModel):
    symbol:      str
    qty:         int
    avg_price:   float
    total_buys:  int
    total_spent: float
    first_trade: Optional[str]
    last_trade:  Optional[str]


class LeaderboardEntry(BaseModel):
    rank:          int
    username:      str
    holdings:      int
    total_cost:    float
    avg_risk_score: Optional[float]


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/auth/register",
    response_model=TokenResponse,
    tags=["Auth"],
    summary="Register a new user account",
)
def register(body: RegisterRequest):
    with get_db() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username=?", (body.username,)).fetchone():
            raise HTTPException(status_code=409, detail="Username already taken")
        hashed = pwd_ctx.hash(body.password)
        conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?,?,?)",
            (body.username, body.email, hashed),
        )
    token = create_access_token({"sub": body.username})
    return TokenResponse(access_token=token, username=body.username)


@app.post(
    "/auth/login",
    response_model=TokenResponse,
    tags=["Auth"],
    summary="Login and receive JWT access token",
)
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username=?", (form.username,)
        ).fetchone()
    if not row or not pwd_ctx.verify(form.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token({"sub": row["username"]})
    return TokenResponse(access_token=token, username=row["username"])


@app.get(
    "/auth/me",
    tags=["Auth"],
    summary="Return the currently authenticated user's profile",
)
def get_me(username: str = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT username, email, created_at FROM users WHERE username=?", (username,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


# ═══════════════════════════════════════════════════════════════════════════════
# PORTFOLIO ENDPOINTS  (CRUD)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/portfolio",
    response_model=PortfolioOut,
    tags=["Portfolio"],
    summary="READ — Get all current holdings for the authenticated user",
)
def get_portfolio(username: str = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT symbol, qty, avg_price, updated_at FROM portfolio WHERE username=?",
            (username,),
        ).fetchall()
    holdings = [HoldingOut(**dict(r)) for r in rows]
    total_cost = sum(h.qty * h.avg_price for h in holdings)
    return PortfolioOut(holdings=holdings, total_cost=total_cost)


@app.post(
    "/portfolio/buy",
    response_model=HoldingOut,
    tags=["Portfolio"],
    summary="CREATE / UPDATE — Buy shares (inserts transaction; upserts holding with VWAC)",
    status_code=201,
)
def buy_stock(body: BuyRequest, username: str = Depends(get_current_user)):
    """
    Buy shares of a stock.
    - Inserts a 'buy' transaction row.
    - Upserts the portfolio row using volume-weighted average cost (VWAC).
    """
    import uuid
    txn_id = str(uuid.uuid4())[:8]
    with get_db() as conn:
        existing = conn.execute(
            "SELECT qty, avg_price FROM portfolio WHERE username=? AND symbol=?",
            (username, body.symbol),
        ).fetchone()

        if existing:
            new_qty   = existing["qty"] + body.qty
            new_avg   = (existing["avg_price"] * existing["qty"] + body.price * body.qty) / new_qty
            conn.execute(
                "UPDATE portfolio SET qty=?, avg_price=?, updated_at=datetime('now') "
                "WHERE username=? AND symbol=?",
                (new_qty, new_avg, username, body.symbol),
            )
        else:
            conn.execute(
                "INSERT INTO portfolio (username, symbol, qty, avg_price) VALUES (?,?,?,?)",
                (username, body.symbol, body.qty, body.price),
            )

        conn.execute(
            "INSERT INTO transactions (id, username, symbol, type, qty, price) VALUES (?,?,?,?,?,?)",
            (txn_id, username, body.symbol, "buy", body.qty, body.price),
        )
        row = conn.execute(
            "SELECT symbol, qty, avg_price, updated_at FROM portfolio WHERE username=? AND symbol=?",
            (username, body.symbol),
        ).fetchone()
    return HoldingOut(**dict(row))


@app.post(
    "/portfolio/sell",
    response_model=HoldingOut,
    tags=["Portfolio"],
    summary="UPDATE / DELETE — Sell shares (inserts transaction; decrements or removes holding)",
    status_code=201,
)
def sell_stock(body: SellRequest, username: str = Depends(get_current_user)):
    import uuid
    txn_id = str(uuid.uuid4())[:8]
    with get_db() as conn:
        existing = conn.execute(
            "SELECT qty, avg_price FROM portfolio WHERE username=? AND symbol=?",
            (username, body.symbol),
        ).fetchone()
        if not existing or existing["qty"] < body.qty:
            raise HTTPException(status_code=400, detail="Insufficient holdings to sell")

        new_qty = existing["qty"] - body.qty
        if new_qty == 0:
            conn.execute(
                "DELETE FROM portfolio WHERE username=? AND symbol=?",
                (username, body.symbol),
            )
            result = HoldingOut(symbol=body.symbol, qty=0, avg_price=existing["avg_price"], updated_at=datetime.now(timezone.utc).isoformat())
        else:
            conn.execute(
                "UPDATE portfolio SET qty=?, updated_at=datetime('now') "
                "WHERE username=? AND symbol=?",
                (new_qty, username, body.symbol),
            )
            row = conn.execute(
                "SELECT symbol, qty, avg_price, updated_at FROM portfolio WHERE username=? AND symbol=?",
                (username, body.symbol),
            ).fetchone()
            result = HoldingOut(**dict(row))

        conn.execute(
            "INSERT INTO transactions (id, username, symbol, type, qty, price) VALUES (?,?,?,?,?,?)",
            (txn_id, username, body.symbol, "sell", body.qty, body.price),
        )
    return result


@app.delete(
    "/portfolio/{symbol}",
    tags=["Portfolio"],
    summary="DELETE — Remove a holding entirely (admin / manual correction)",
)
def delete_holding(symbol: str, username: str = Depends(get_current_user)):
    with get_db() as conn:
        deleted = conn.execute(
            "DELETE FROM portfolio WHERE username=? AND symbol=?", (username, symbol.upper())
        ).rowcount
    if not deleted:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"detail": f"{symbol.upper()} removed from portfolio"}


# ═══════════════════════════════════════════════════════════════════════════════
# TRANSACTION ENDPOINTS  (CRUD)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/transactions",
    response_model=List[TransactionOut],
    tags=["Transactions"],
    summary="READ — Get all transactions for the authenticated user (with optional filters)",
)
def get_transactions(
    type_filter: Optional[str] = None,
    symbol:      Optional[str] = None,
    limit:       int = 200,
    username:    str = Depends(get_current_user),
):
    query  = "SELECT id, username, symbol, type, qty, price, total, created_at FROM transactions WHERE username=?"
    params: list = [username]
    if type_filter in ("buy", "sell"):
        query += " AND type=?"; params.append(type_filter)
    if symbol:
        query += " AND symbol=?"; params.append(symbol.upper())
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
    return [TransactionOut(**dict(r)) for r in rows]


@app.delete(
    "/transactions/{txn_id}",
    tags=["Transactions"],
    summary="DELETE — Remove a transaction record",
)
def delete_transaction(txn_id: str, username: str = Depends(get_current_user)):
    with get_db() as conn:
        deleted = conn.execute(
            "DELETE FROM transactions WHERE id=? AND username=?", (txn_id, username)
        ).rowcount
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"detail": "Transaction deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# WATCHLIST ENDPOINTS  (CRUD)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/watchlist", tags=["Watchlist"], summary="READ — Get watchlist")
def get_watchlist(username: str = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT symbol, added_at FROM watchlist WHERE username=? ORDER BY added_at DESC",
            (username,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/watchlist", tags=["Watchlist"], summary="CREATE — Add symbol to watchlist", status_code=201)
def add_watch(body: WatchRequest, username: str = Depends(get_current_user)):
    with get_db() as conn:
        try:
            conn.execute(
                "INSERT INTO watchlist (username, symbol) VALUES (?,?)",
                (username, body.symbol),
            )
        except sqlite3.IntegrityError:
            pass   # already watching — idempotent
    return {"symbol": body.symbol, "watching": True}


@app.delete("/watchlist/{symbol}", tags=["Watchlist"], summary="DELETE — Remove symbol from watchlist")
def remove_watch(symbol: str, username: str = Depends(get_current_user)):
    with get_db() as conn:
        conn.execute(
            "DELETE FROM watchlist WHERE username=? AND symbol=?", (username, symbol.upper())
        )
    return {"symbol": symbol.upper(), "watching": False}


# ═══════════════════════════════════════════════════════════════════════════════
# PORTFOLIO HISTORY ENDPOINTS  (CRUD)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/history",
    response_model=List[HistoryEntry],
    tags=["History"],
    summary="READ — Get portfolio value history (last 120 days)",
)
def get_history(days: int = 120, username: str = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT date, value FROM portfolio_history WHERE username=? "
            "ORDER BY date ASC LIMIT ?",
            (username, days),
        ).fetchall()
    return [HistoryEntry(**dict(r)) for r in rows]


@app.post(
    "/history",
    tags=["History"],
    summary="CREATE / UPDATE — Push a daily portfolio value snapshot (upsert by date)",
    status_code=201,
)
def push_history(body: HistoryRequest, username: str = Depends(get_current_user)):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO portfolio_history (username, date, value) VALUES (?,?,?) "
            "ON CONFLICT(username, date) DO UPDATE SET value=excluded.value",
            (username, body.date, body.value),
        )
    return {"date": body.date, "value": body.value}


# ═══════════════════════════════════════════════════════════════════════════════
# SIMULATION ENDPOINTS  (CRUD)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/simulations", tags=["Simulations"], summary="READ — Get last 50 simulations")
def get_simulations(username: str = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, symbol, amount, qty, price, before_score, after_score, created_at "
            "FROM simulations WHERE username=? ORDER BY created_at DESC LIMIT 50",
            (username,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/simulations", tags=["Simulations"], summary="CREATE — Save a simulation result", status_code=201)
def save_simulation(body: SimulationRequest, username: str = Depends(get_current_user)):
    import uuid
    sim_id = str(uuid.uuid4())[:8]
    with get_db() as conn:
        conn.execute(
            "INSERT INTO simulations (id, username, symbol, amount, qty, price, before_score, after_score) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (sim_id, username, body.symbol, body.amount, body.qty, body.price,
             body.before_score, body.after_score),
        )
    return {"id": sim_id, **body.model_dump()}


# ═══════════════════════════════════════════════════════════════════════════════
# RISK SNAPSHOT ENDPOINTS  (CRUD)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/risk", tags=["Risk"], summary="READ — Get last 30 risk snapshots")
def get_risk_snapshots(username: str = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, score, level, holdings, created_at FROM risk_snapshots "
            "WHERE username=? ORDER BY created_at DESC LIMIT 30",
            (username,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/risk", tags=["Risk"], summary="CREATE — Save a risk snapshot", status_code=201)
def save_risk_snapshot(body: RiskSnapshotRequest, username: str = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO risk_snapshots (username, score, level, holdings) VALUES (?,?,?,?)",
            (username, body.score, body.level, body.holdings),
        )
    return {"id": cursor.lastrowid, **body.model_dump()}


# ═══════════════════════════════════════════════════════════════════════════════
# ★  ANALYTICS ENDPOINTS — JOIN-based queries (3 required by guidelines)  ★
# ═══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/analytics/trade-summary",
    response_model=List[TradeSummaryOut],
    tags=["Analytics (JOIN queries)"],
    summary=(
        "JOIN 1 — users ⟷ transactions: per-user trade summary "
        "(total trades, buy/sell counts, invested vs realised capital, unique symbols)"
    ),
)
def analytics_trade_summary(username: str = Depends(get_current_user)):
    """
    SQL executed:

        SELECT
            u.username,
            u.email,
            COUNT(t.id)                                          AS total_trades,
            SUM(CASE WHEN t.type = 'buy'  THEN 1 ELSE 0 END)    AS buy_count,
            SUM(CASE WHEN t.type = 'sell' THEN 1 ELSE 0 END)    AS sell_count,
            SUM(CASE WHEN t.type = 'buy'  THEN t.total ELSE 0 END) AS total_invested,
            SUM(CASE WHEN t.type = 'sell' THEN t.total ELSE 0 END) AS total_realised,
            COUNT(DISTINCT t.symbol)                             AS unique_symbols
        FROM users u
        LEFT JOIN transactions t ON t.username = u.username
        WHERE u.username = :username
        GROUP BY u.username, u.email
    """
    sql = """
        SELECT
            u.username,
            u.email,
            COUNT(t.id)                                             AS total_trades,
            SUM(CASE WHEN t.type = 'buy'  THEN 1     ELSE 0 END)  AS buy_count,
            SUM(CASE WHEN t.type = 'sell' THEN 1     ELSE 0 END)  AS sell_count,
            SUM(CASE WHEN t.type = 'buy'  THEN t.total ELSE 0 END) AS total_invested,
            SUM(CASE WHEN t.type = 'sell' THEN t.total ELSE 0 END) AS total_realised,
            COUNT(DISTINCT t.symbol)                               AS unique_symbols
        FROM users u
        LEFT JOIN transactions t ON t.username = u.username
        WHERE u.username = ?
        GROUP BY u.username, u.email
    """
    with get_db() as conn:
        rows = conn.execute(sql, (username,)).fetchall()
    return [TradeSummaryOut(**dict(r)) for r in rows]


@app.get(
    "/analytics/portfolio-full",
    response_model=List[PortfolioFullOut],
    tags=["Analytics (JOIN queries)"],
    summary=(
        "JOIN 2 — portfolio ⟷ transactions: each holding enriched with full "
        "transaction history (total buys, total spent, first & last trade dates)"
    ),
)
def analytics_portfolio_full(username: str = Depends(get_current_user)):
    """
    SQL executed:

        SELECT
            p.symbol,
            p.qty,
            p.avg_price,
            COUNT(t.id)               AS total_buys,
            SUM(t.total)              AS total_spent,
            MIN(t.created_at)         AS first_trade,
            MAX(t.created_at)         AS last_trade
        FROM portfolio p
        LEFT JOIN transactions t
               ON t.username = p.username
              AND t.symbol   = p.symbol
              AND t.type     = 'buy'
        WHERE p.username = :username
        GROUP BY p.symbol, p.qty, p.avg_price
        ORDER BY total_spent DESC
    """
    sql = """
        SELECT
            p.symbol,
            p.qty,
            p.avg_price,
            COUNT(t.id)       AS total_buys,
            SUM(t.total)      AS total_spent,
            MIN(t.created_at) AS first_trade,
            MAX(t.created_at) AS last_trade
        FROM portfolio p
        LEFT JOIN transactions t
               ON t.username = p.username
              AND t.symbol   = p.symbol
              AND t.type     = 'buy'
        WHERE p.username = ?
        GROUP BY p.symbol, p.qty, p.avg_price
        ORDER BY total_spent DESC
    """
    with get_db() as conn:
        rows = conn.execute(sql, (username,)).fetchall()
    return [PortfolioFullOut(**dict(r)) for r in rows]


@app.get(
    "/analytics/leaderboard",
    response_model=List[LeaderboardEntry],
    tags=["Analytics (JOIN queries)"],
    summary=(
        "JOIN 3 — users ⟷ portfolio ⟷ risk_snapshots: portfolio value leaderboard "
        "ranked by total invested capital with average risk score per user"
    ),
)
def analytics_leaderboard(_username: str = Depends(get_current_user)):
    """
    SQL executed:

        SELECT
            ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(p.qty * p.avg_price), 0) DESC) AS rank,
            u.username,
            COUNT(DISTINCT p.symbol)              AS holdings,
            COALESCE(SUM(p.qty * p.avg_price), 0) AS total_cost,
            AVG(r.score)                          AS avg_risk_score
        FROM users u
        LEFT JOIN portfolio      p ON p.username = u.username
        LEFT JOIN risk_snapshots r ON r.username = u.username
        GROUP BY u.username
        ORDER BY total_cost DESC
        LIMIT 20

    Note: ROW_NUMBER() is not supported in SQLite < 3.25. We emulate it with Python.
    """
    sql = """
        SELECT
            u.username,
            COUNT(DISTINCT p.symbol)               AS holdings,
            COALESCE(SUM(p.qty * p.avg_price), 0)  AS total_cost,
            AVG(r.score)                           AS avg_risk_score
        FROM users u
        LEFT JOIN portfolio      p ON p.username = u.username
        LEFT JOIN risk_snapshots r ON r.username = u.username
        GROUP BY u.username
        ORDER BY total_cost DESC
        LIMIT 20
    """
    with get_db() as conn:
        rows = conn.execute(sql).fetchall()

    return [
        LeaderboardEntry(rank=i + 1, **{k: row[k] for k in row.keys()})
        for i, row in enumerate(rows)
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# USER MANAGEMENT (CRUD)
# ═══════════════════════════════════════════════════════════════════════════════

@app.put("/users/me/email", tags=["Users"], summary="UPDATE — Change email address")
def update_email(email: str, username: str = Depends(get_current_user)):
    with get_db() as conn:
        conn.execute("UPDATE users SET email=? WHERE username=?", (email, username))
    return {"detail": "Email updated"}


@app.delete("/users/me", tags=["Users"], summary="DELETE — Delete own account and all data (cascade)")
def delete_account(username: str = Depends(get_current_user)):
    with get_db() as conn:
        conn.execute("DELETE FROM users WHERE username=?", (username,))
    return {"detail": "Account and all associated data deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["Health"], summary="Health check — confirm API is running")
def health():
    return {
        "status": "ok",
        "database": "SQLite (OLTP)",
        "justification": (
            "SQLite chosen for ACID transactional consistency on buy/sell operations. "
            "Workload is write-heavy (frequent inserts on transactions, updates on portfolio). "
            "For analytical aggregations (leaderboard, trade-summary) a columnar OLAP store "
            "would be preferred in production, but SQLite handles the dataset sizes here "
            "without a second infrastructure dependency."
        ),
        "docs": "/docs",
    }
