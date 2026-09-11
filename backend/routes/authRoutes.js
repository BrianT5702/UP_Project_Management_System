const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { APPROVALS_REQUIRED, LOCK_AFTER_ATTEMPTS } = require('../helpers/superadminSetup');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

const ALLOWED_POSITIONS = [
    'admin', 'panel manager', 'sale', 'cut', 'door',
    'accessories', 'system', 'transportation', 'panel'
];

const ALLOWED_STATUSES = ['pending', 'active', 'rejected', 'locked'];
const USER_COLUMNS = 'id, username, position, status, created_at, failed_login_attempts, must_reset_password';

function signToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, position: user.position, status: user.status },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function publicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
        position: user.position,
        status: user.status,
        must_reset_password: Boolean(user.must_reset_password),
    };
}

function requireSuperadmin(req, res, next) {
    authMiddleware(req, res, async () => {
        try {
            const [rows] = await db.query(
                `SELECT ${USER_COLUMNS} FROM users WHERE id = ?`,
                [req.user.id]
            );
            if (
                rows.length === 0 ||
                rows[0].status !== 'active' ||
                String(rows[0].position).toLowerCase() !== 'superadmin'
            ) {
                return res.status(403).json({ error: 'Superadmin access required' });
            }
            req.superadmin = rows[0];
            next();
        } catch (error) {
            console.error('Superadmin auth error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}

async function getApprovals(actionType, targetUserId, relatedId = 0) {
    const [rows] = await db.query(
        `SELECT a.approver_id AS id, u.username, a.created_at
         FROM superadmin_approvals a
         JOIN users u ON u.id = a.approver_id
         WHERE a.action_type = ? AND a.target_user_id = ? AND a.related_id = ?
         ORDER BY a.created_at ASC`,
        [actionType, targetUserId, relatedId]
    );
    return rows;
}

async function recordApproval(actionType, targetUserId, relatedId, approverId) {
    try {
        await db.query(
            `INSERT INTO superadmin_approvals (action_type, target_user_id, related_id, approver_id)
             VALUES (?, ?, ?, ?)`,
            [actionType, targetUserId, relatedId || 0, approverId]
        );
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            const err = new Error('You have already approved this request');
            err.status = 409;
            throw err;
        }
        throw error;
    }
    return getApprovals(actionType, targetUserId, relatedId || 0);
}

async function clearApprovals(actionType, targetUserId, relatedId = 0) {
    await db.query(
        `DELETE FROM superadmin_approvals
         WHERE action_type = ? AND target_user_id = ? AND related_id = ?`,
        [actionType, targetUserId, relatedId]
    );
}

function withApprovalMeta(item, approvals, meId) {
    return {
        ...item,
        approvals,
        approvalCount: approvals.length,
        requiredApprovals: APPROVALS_REQUIRED,
        approvedByMe: approvals.some((vote) => vote.id === meId),
    };
}

async function registerHandler(req, res) {
    const { username, password, position } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (String(username).trim().length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
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

        res.status(201).json({
            message: 'User registered successfully. Awaiting two superadmin approvals.',
            user: { id: result.insertId, username, position, status: 'pending' }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

router.post('/signup', registerHandler);
router.post('/register', registerHandler);

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const [rows] = await db.query(
            `SELECT id, username, password_hash, position, status, failed_login_attempts, must_reset_password
             FROM users WHERE username = ?`,
            [username]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];

        if (user.status === 'locked') {
            return res.status(403).json({
                error: 'Account locked after 3 failed sign-in attempts. A superadmin must unblock it, then you will be asked to reset your password.',
                code: 'LOCKED',
            });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            const attempts = Number(user.failed_login_attempts || 0) + 1;
            if (attempts >= LOCK_AFTER_ATTEMPTS) {
                await db.query(
                    `UPDATE users
                     SET failed_login_attempts = ?, status = 'locked'
                     WHERE id = ?`,
                    [attempts, user.id]
                );
                return res.status(403).json({
                    error: 'Account locked after 3 failed sign-in attempts. Ask a superadmin to unblock it.',
                    code: 'LOCKED',
                });
            }

            await db.query(
                'UPDATE users SET failed_login_attempts = ? WHERE id = ?',
                [attempts, user.id]
            );
            const remaining = LOCK_AFTER_ATTEMPTS - attempts;
            return res.status(401).json({
                error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before the account is locked.`,
                code: 'INVALID_CREDENTIALS',
                remainingAttempts: remaining,
            });
        }

        if (user.status !== 'active') {
            if (user.status === 'pending') {
                return res.status(403).json({
                    error: 'Your account is pending approval. Two superadmins must activate it.',
                    code: 'PENDING',
                });
            }
            if (user.status === 'rejected') {
                return res.status(403).json({
                    error: 'Your account has been rejected. Contact a superadmin.',
                    code: 'REJECTED',
                });
            }
            return res.status(403).json({ error: 'Account unavailable. Please contact support.' });
        }

        if (Number(user.must_reset_password) === 1) {
            return res.status(403).json({
                error: 'Your account was unblocked. You must reset your password before signing in.',
                code: 'MUST_RESET',
            });
        }

        await db.query(
            'UPDATE users SET failed_login_attempts = 0 WHERE id = ?',
            [user.id]
        );

        const token = signToken(user);
        res.json({
            message: 'Login successful',
            token,
            user: publicUser({ ...user, failed_login_attempts: 0 }),
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/password-reset/request', async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
        return res.status(400).json({ error: 'Username and new password are required' });
    }
    if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    try {
        const [rows] = await db.query(
            `SELECT ${USER_COLUMNS} FROM users WHERE username = ?`,
            [username]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No account found for that username' });
        }

        const user = rows[0];
        if (user.status === 'locked') {
            return res.status(403).json({
                error: 'This account is locked. A superadmin must unblock it before you can reset the password.',
                code: 'LOCKED',
            });
        }
        if (user.status === 'pending') {
            return res.status(403).json({ error: 'This account is still pending signup approval.' });
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ error: 'This account was rejected. Contact a superadmin.' });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'This account cannot reset a password right now.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.query(
            `UPDATE password_reset_requests SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'`,
            [user.id]
        );
        const [result] = await db.query(
            `INSERT INTO password_reset_requests (user_id, new_password_hash, status) VALUES (?, ?, 'pending')`,
            [user.id, hashedPassword]
        );

        res.json({
            message: 'Password reset submitted. Two superadmins must acknowledge and approve it before you can sign in with the new password.',
            requestId: result.insertId,
        });
    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/superadmin/dashboard', requireSuperadmin, async (req, res) => {
    try {
        const meId = req.superadmin.id;

        const [pendingSignups] = await db.query(
            `SELECT ${USER_COLUMNS} FROM users WHERE status = 'pending' ORDER BY id DESC`
        );
        const [pendingResets] = await db.query(
            `SELECT r.id, r.user_id, r.status, r.created_at,
                    u.username, u.position, u.status AS user_status
             FROM password_reset_requests r
             JOIN users u ON u.id = r.user_id
             WHERE r.status = 'pending'
             ORDER BY r.id DESC`
        );
        const [lockedUsers] = await db.query(
            `SELECT ${USER_COLUMNS} FROM users WHERE status = 'locked' ORDER BY id DESC`
        );
        const [users] = await db.query(
            `SELECT ${USER_COLUMNS} FROM users ORDER BY id DESC`
        );

        const signupRows = [];
        for (const user of pendingSignups) {
            const approvals = await getApprovals('signup', user.id, 0);
            signupRows.push(withApprovalMeta(user, approvals, meId));
        }

        const resetRows = [];
        for (const reset of pendingResets) {
            const approvals = await getApprovals('password_reset', reset.user_id, reset.id);
            resetRows.push(withApprovalMeta(reset, approvals, meId));
        }

        const lockedRows = [];
        for (const user of lockedUsers) {
            const approvals = await getApprovals('unblock', user.id, 0);
            lockedRows.push(withApprovalMeta(user, approvals, meId));
        }

        res.json({
            requiredApprovals: APPROVALS_REQUIRED,
            lockAfterAttempts: LOCK_AFTER_ATTEMPTS,
            me: { id: req.superadmin.id, username: req.superadmin.username },
            pendingSignups: signupRows,
            pendingResets: resetRows,
            lockedUsers: lockedRows,
            users,
        });
    } catch (error) {
        console.error('Superadmin dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/users', requireSuperadmin, async (req, res) => {
    try {
        const { position } = req.query;
        let query = `SELECT ${USER_COLUMNS} FROM users`;
        const params = [];
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

router.get('/users/pending', requireSuperadmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ${USER_COLUMNS} FROM users WHERE status = 'pending' ORDER BY id DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Fetch pending users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/users/:id', requireSuperadmin, async (req, res) => {
    const { id } = req.params;
    const { role, status } = req.body;

    if (role && (role === 'superadmin' || !ALLOWED_POSITIONS.includes(role))) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    if (status && !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const [existing] = await db.query('SELECT id, position FROM users WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (String(existing[0].position).toLowerCase() === 'superadmin') {
            return res.status(403).json({ error: 'Superadmin accounts cannot be edited here' });
        }

        const updates = [];
        const values = [];
        if (role) { updates.push('position = ?'); values.push(role); }
        if (status) { updates.push('status = ?'); values.push(status); }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nothing to update' });
        }
        values.push(id);
        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

        const [updated] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
        res.json({ message: 'User updated', user: updated[0] });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/users/:id/approve', requireSuperadmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = rows[0];
        if (user.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending signups can be approved' });
        }

        const approvals = await recordApproval('signup', user.id, 0, req.superadmin.id);
        if (approvals.length < APPROVALS_REQUIRED) {
            return res.json({
                message: `Signup acknowledged. Waiting for a second superadmin (${approvals.length}/${APPROVALS_REQUIRED}).`,
                complete: false,
                user: withApprovalMeta(user, approvals, req.superadmin.id),
            });
        }

        await db.query(
            `UPDATE users SET status = 'active', failed_login_attempts = 0, must_reset_password = 0 WHERE id = ?`,
            [user.id]
        );
        await clearApprovals('signup', user.id, 0);
        const [updated] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
        res.json({
            message: 'Signup approved by two superadmins. Account is now active.',
            complete: true,
            user: updated[0],
        });
    } catch (error) {
        const status = error.status || 500;
        if (status === 500) console.error('Approval error:', error);
        res.status(status).json({ error: error.message || 'Internal server error' });
    }
});

router.put('/users/:id/reject', requireSuperadmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (rows[0].status !== 'pending') {
            return res.status(400).json({ error: 'Only pending signups can be rejected' });
        }

        await db.query(`UPDATE users SET status = 'rejected' WHERE id = ?`, [id]);
        await clearApprovals('signup', id, 0);
        const [updated] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
        res.json({ message: 'User rejected', user: updated[0] });
    } catch (error) {
        console.error('Rejection error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/password-reset/:id/approve', requireSuperadmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT r.id, r.user_id, r.new_password_hash, r.status, u.username, u.status AS user_status
             FROM password_reset_requests r
             JOIN users u ON u.id = r.user_id
             WHERE r.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Password reset request not found' });
        }
        const reset = rows[0];
        if (reset.status !== 'pending') {
            return res.status(400).json({ error: 'This reset request is no longer pending' });
        }
        if (reset.user_status === 'locked') {
            return res.status(400).json({ error: 'Unblock this account before approving a password reset' });
        }

        const approvals = await recordApproval('password_reset', reset.user_id, reset.id, req.superadmin.id);
        if (approvals.length < APPROVALS_REQUIRED) {
            return res.json({
                message: `Password reset acknowledged. Waiting for a second superadmin (${approvals.length}/${APPROVALS_REQUIRED}).`,
                complete: false,
                approvalCount: approvals.length,
                requiredApprovals: APPROVALS_REQUIRED,
                approvals,
            });
        }

        await db.query(
            `UPDATE users
             SET password_hash = ?, failed_login_attempts = 0, must_reset_password = 0, status = 'active'
             WHERE id = ?`,
            [reset.new_password_hash, reset.user_id]
        );
        await db.query(
            `UPDATE password_reset_requests SET status = 'approved' WHERE id = ?`,
            [reset.id]
        );
        await clearApprovals('password_reset', reset.user_id, reset.id);

        res.json({
            message: `Password reset for ${reset.username} approved. They can now sign in with the new password.`,
            complete: true,
        });
    } catch (error) {
        const status = error.status || 500;
        if (status === 500) console.error('Password reset approve error:', error);
        res.status(status).json({ error: error.message || 'Internal server error' });
    }
});

router.put('/password-reset/:id/reject', requireSuperadmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(
            'SELECT id, user_id, status FROM password_reset_requests WHERE id = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Password reset request not found' });
        }
        if (rows[0].status !== 'pending') {
            return res.status(400).json({ error: 'This reset request is no longer pending' });
        }
        await db.query(`UPDATE password_reset_requests SET status = 'rejected' WHERE id = ?`, [id]);
        await clearApprovals('password_reset', rows[0].user_id, rows[0].id);
        res.json({ message: 'Password reset request rejected' });
    } catch (error) {
        console.error('Password reset reject error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/users/:id/unblock', requireSuperadmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = rows[0];
        if (user.status !== 'locked') {
            return res.status(400).json({ error: 'Only locked accounts can be unblocked' });
        }

        const approvals = await recordApproval('unblock', user.id, 0, req.superadmin.id);
        if (approvals.length < APPROVALS_REQUIRED) {
            return res.json({
                message: `Unblock acknowledged. Waiting for a second superadmin (${approvals.length}/${APPROVALS_REQUIRED}).`,
                complete: false,
                user: withApprovalMeta(user, approvals, req.superadmin.id),
            });
        }

        await db.query(
            `UPDATE users
             SET status = 'active', failed_login_attempts = 0, must_reset_password = 1
             WHERE id = ?`,
            [user.id]
        );
        await clearApprovals('unblock', user.id, 0);
        const [updated] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
        res.json({
            message: `${user.username} is unblocked. They must reset their password before signing in.`,
            complete: true,
            user: updated[0],
        });
    } catch (error) {
        const status = error.status || 500;
        if (status === 500) console.error('Unblock error:', error);
        res.status(status).json({ error: error.message || 'Internal server error' });
    }
});

router.delete('/users/:id', requireSuperadmin, async (req, res) => {
    const { id } = req.params;
    const userId = Number(id);
    if (!userId) {
        return res.status(400).json({ error: 'Invalid user id' });
    }
    if (userId === Number(req.superadmin.id)) {
        return res.status(403).json({ error: 'You cannot remove your own account' });
    }

    try {
        const [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = rows[0];
        if (String(user.position).toLowerCase() === 'superadmin') {
            return res.status(403).json({ error: 'Superadmin accounts cannot be removed' });
        }

        await db.query('DELETE FROM superadmin_approvals WHERE target_user_id = ? OR approver_id = ?', [userId, userId]);
        await db.query('DELETE FROM password_reset_requests WHERE user_id = ?', [userId]);
        await db.query('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ message: `Account ${user.username} removed`, username: user.username });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Could not remove this account. It may still be linked to other records.' });
    }
});

module.exports = router;
