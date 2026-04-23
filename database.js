const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'voting.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    bio TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    candidate_id INTEGER NOT NULL,
    voted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
  );
`);

// Seed admin account
const adminPassword = bcrypt.hashSync('admin123', 10);
db.prepare(`INSERT OR IGNORE INTO users (username, password, is_admin) VALUES (?, ?, 1)`)
  .run('admin', adminPassword);

// Seed 20 default candidates (only if no candidates exist)
const count = db.prepare('SELECT COUNT(*) as count FROM candidates').get().count;
if (count === 0) {
  const candidates = [
    'Alice Chen', 'Bob Martinez', 'Charlie Kim', 'Diana Patel',
    'Ethan Brown', 'Fiona Lee', 'George Wang', 'Hannah Singh',
    'Ivan Rossi', 'Julia Kowalski', 'Kevin Nakamura', 'Lina Oliveira',
    'Marco Santos', 'Nina Johansson', 'Omar Hassan', 'Priya Sharma',
    "Quinn O'Brien", 'Rosa Hernandez', 'Satoshi Tanaka', 'Tina Ivanova'
  ];
  const insert = db.prepare(`INSERT INTO candidates (name) VALUES (?)`);
  for (const name of candidates) {
    insert.run(name);
  }
  console.log('Default candidates seeded.');
}

console.log('Database ready. Admin login: admin / admin123');

module.exports = db;
