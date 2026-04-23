const db = require('./database');
const bcrypt = require('bcryptjs');

// Seed admin account
const adminPassword = bcrypt.hashSync('admin123', 10);
db.prepare(`INSERT OR IGNORE INTO users (username, password, is_admin) VALUES (?, ?, 1)`)
  .run('admin', adminPassword);

// Seed 20 candidates
const candidates = [
  'Alice Chen', 'Bob Martinez', 'Charlie Kim', 'Diana Patel',
  'Ethan Brown', 'Fiona Lee', 'George Wang', 'Hannah Singh',
  'Ivan Rossi', 'Julia Kowalski', 'Kevin Nakamura', 'Lina Oliveira',
  'Marco Santos', 'Nina Johansson', 'Omar Hassan', 'Priya Sharma',
  'Quinn O\'Brien', 'Rosa Hernandez', 'Satoshi Tanaka', 'Tina Ivanova'
];

const insert = db.prepare(`INSERT OR IGNORE INTO candidates (name) VALUES (?)`);
for (const name of candidates) {
  insert.run(name);
}

console.log('Database seeded!');
console.log('Admin login: admin / admin123');
console.log(`${candidates.length} candidates added.`);
