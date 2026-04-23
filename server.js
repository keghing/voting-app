const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'class-monitor-election-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect('/');
  next();
}

// ---------- AUTH ROUTES ----------

app.get('/login', (req, res) => {
  res.render('login', { error: null, registered: req.query.registered === '1' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Please fill in all fields.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'Invalid username or password.' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.isAdmin = user.is_admin === 1;
  res.redirect('/');
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { username, password, confirm } = req.body;
  if (!username || !password) {
    return res.render('register', { error: 'Please fill in all fields.' });
  }
  if (password.length < 4) {
    return res.render('register', { error: 'Password must be at least 4 characters.' });
  }
  if (password !== confirm) {
    return res.render('register', { error: 'Passwords do not match.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.render('register', { error: 'Username already taken.' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed);
  res.redirect('/login?registered=1');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ---------- MAIN ROUTES ----------

app.get('/', requireAuth, (req, res) => {
  const hasVoted = db.prepare('SELECT id FROM votes WHERE user_id = ?').get(req.session.userId);
  if (hasVoted) return res.redirect('/results');
  res.redirect('/vote');
});

app.get('/vote', requireAuth, (req, res) => {
  const hasVoted = db.prepare('SELECT id FROM votes WHERE user_id = ?').get(req.session.userId);
  if (hasVoted) return res.redirect('/results');
  const candidates = db.prepare('SELECT * FROM candidates ORDER BY name').all();
  const totalVoters = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').get().count;
  const votedCount = db.prepare('SELECT COUNT(*) as count FROM votes').get().count;
  res.render('vote', {
    candidates,
    username: req.session.username,
    totalVoters,
    votedCount,
    error: null
  });
});

app.post('/vote', requireAuth, (req, res) => {
  const hasVoted = db.prepare('SELECT id FROM votes WHERE user_id = ?').get(req.session.userId);
  if (hasVoted) return res.redirect('/results');
  const candidateId = parseInt(req.body.candidate);
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId);
  if (!candidate) {
    const candidates = db.prepare('SELECT * FROM candidates ORDER BY name').all();
    return res.render('vote', { candidates, username: req.session.username, error: 'Invalid candidate selected.' });
  }
  db.prepare('INSERT INTO votes (user_id, candidate_id) VALUES (?, ?)').run(req.session.userId, candidateId);
  res.redirect('/results');
});

app.get('/results', requireAuth, (req, res) => {
  const results = db.prepare(`
    SELECT c.id, c.name, COUNT(v.id) as votes
    FROM candidates c
    LEFT JOIN votes v ON v.candidate_id = c.id
    GROUP BY c.id
    ORDER BY votes DESC, c.name ASC
  `).all();
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const totalVoters = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').get().count;
  const userVote = db.prepare(`
    SELECT c.name FROM votes v JOIN candidates c ON c.id = v.candidate_id WHERE v.user_id = ?
  `).get(req.session.userId);
  res.render('results', {
    results,
    totalVotes,
    totalVoters,
    userVote: userVote?.name,
    username: req.session.username,
    isAdmin: req.session.isAdmin
  });
});

// ---------- ADMIN ROUTES ----------

app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  const candidates = db.prepare('SELECT * FROM candidates ORDER BY name').all();
  const stats = {
    voters: db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').get().count,
    votes: db.prepare('SELECT COUNT(*) as count FROM votes').get().count
  };
  res.render('admin', { candidates, stats, username: req.session.username, error: null });
});

app.post('/admin/candidates', requireAuth, requireAdmin, (req, res) => {
  const { name, bio } = req.body;
  if (!name) {
    const candidates = db.prepare('SELECT * FROM candidates ORDER BY name').all();
    return res.render('admin', { candidates, stats: {}, username: req.session.username, error: 'Candidate name required.' });
  }
  try {
    db.prepare('INSERT INTO candidates (name, bio) VALUES (?, ?)').run(name, bio || '');
  } catch (e) {
    // duplicate
  }
  res.redirect('/admin');
});

app.post('/admin/candidates/delete/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM votes WHERE candidate_id = ?').run(req.params.id);
  db.prepare('DELETE FROM candidates WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/reset', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM votes').run();
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Voting app running at http://localhost:${PORT}`);
});
