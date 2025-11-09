const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const Database = require('better-sqlite3');
const fs = require('fs');

// --- basic setup ---
const app = express();
const PORT = process.env.PORT || 3000;

// make sure data folder exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}

// --- database setup ---
const db = new Database('./data/payfriends.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lender_name TEXT NOT NULL,
    borrower_email TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// --- middleware ---
app.use(morgan('dev'));
app.use(bodyParser.json());

// serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// helper: convert euros → cents
function toCents(amountStr) {
  const n = Number(amountStr);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// --- API routes ---

// list all agreements
app.get('/api/agreements', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM agreements ORDER BY created_at DESC'
  ).all();
  res.json(rows);
});

// create new agreement
app.post('/api/agreements', (req, res) => {
  const { lenderName, borrowerEmail, amount, dueDate } = req.body || {};

  if (!lenderName || !borrowerEmail || !amount || !dueDate) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const amountCents = toCents(amount);
  if (amountCents === null) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO agreements (lender_name, borrower_email, amount_cents, due_date, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const info = stmt.run(lenderName, borrowerEmail, amountCents, dueDate, createdAt);

  res.status(201).json({
    id: info.lastInsertRowid,
    lenderName,
    borrowerEmail,
    amountCents,
    dueDate,
    createdAt
  });
});

// health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// start server
app.listen(PORT, () => {
  console.log(`PayFriends MVP running at http://localhost:${PORT}`);
});