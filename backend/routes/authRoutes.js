// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

const ALLOWED_POSITIONS = [
    'admin', 'panel manager', 'sale', 'cut', 'door',
    'accessories', 'system', 'transportation', 'panel'
];

const ALLOWED_STATUSES = ['pending', 'active', 'rejected'];

// ---------- REGISTER / SIGNUP (status = 'pending') ----------
async function registerHandler(req, res) {
    const { username, password, position } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (!position || !ALLOWED_POSITIONS.includes(position)) {
        return res.status(400).json({
            error: `Invalid position. Allowed: ${ALLOWED_POSITIONS.join(', ')}`
        });
    }

    try {
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const [result] = await db.query(
            'INSERT INTO users (username, password_hash, position, status) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, position, 'pending']
        );

        const token = jwt.sign(
            { id: result.insertId, username, position, status: 'pending' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully. Awaiting admin approval.',
            token,
            user: { id: result.insertId, username, position, status: 'pending' }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

router.post('/signup', registerHandler);
router.post('/register', registerHandler); // alias

// ---------- LOGIN (only if status = 'active') ----------
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const [rows] = await db.query(
            'SELECT id, username, password_hash, position, status FROM users WHERE username = ?',
            [username]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            if (user.status === 'pending') {
                return res.status(403).json({ error: 'Your account is pending approval. Please wait for admin activation.' });
            } else if (user.status === 'rejected') {
                return res.status(403).json({ error: 'Your account has been rejected. Contact your administrator.' });
            } else {
                return res.status(403).json({ error: 'Account unavailable. Please contact support.' });
            }
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, position: user.position, status: user.status },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, position: user.position, status: user.status }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------- USER MANAGEMENT ROUTES (NO AUTHENTICATION) ----------

// GET ALL USERS (optionally filtered by position)
router.get('/users', async (req, res) => {
  try {
    const { position } = req.query;
    let query = 'SELECT id, username, position, status, created_at FROM users';
    const params = [];

    // If a position is provided, add a WHERE clause
    if (position) {
      query += ' WHERE position = ?';
      params.push(position);
    }

    query += ' ORDER BY id DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET PENDING USERS
router.get('/users/pending', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, position, status, created_at FROM users WHERE status = 'pending' ORDER BY id DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error('Fetch pending users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// UPDATE USER (Role & Status)
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { role, status } = req.body;

  if (role && !ALLOWED_POSITIONS.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updates = [];
    const values = [];
    if (role) { updates.push('position = ?'); values.push(role); }
    if (status) { updates.push('status = ?'); values.push(status); }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    values.push(id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updated] = await db.query(
      'SELECT id, username, position, status FROM users WHERE id = ?',
      [id]
    );
    res.json({ message: 'User updated', user: updated[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/users/:id/approve', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(
            'UPDATE users SET status = ? WHERE id = ?',
            ['active', id]
        );
        const [updated] = await db.query(
            'SELECT id, username, position, status FROM users WHERE id = ?',
            [id]
        );
        if (updated.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User approved', user: updated[0] });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// REJECT USER – sets status to 'rejected'
router.put('/users/:id/reject', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(
            'UPDATE users SET status = ? WHERE id = ?',
            ['rejected', id]
        );
        const [updated] = await db.query(
            'SELECT id, username, position, status FROM users WHERE id = ?',
            [id]
        );
        if (updated.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User rejected', user: updated[0] });
    } catch (error) {
        console.error('Rejection error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;