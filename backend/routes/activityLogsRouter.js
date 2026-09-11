const express = require('express');
const router = express.Router();
const db = require('../db/connection'); // your MySQL connection (should be mysql2/promise)

/**
 * @desc Get all activity logs with optional filtering, pagination
 * @route GET /api/activity-logs
 * @access Private (Admin/Authenticated) – add your auth middleware!
 */
router.get('/', async (req, res) => {
    try {
        const {
            user_id,
            activity_type,
            resource_type,
            resource_id,
            start_date,
            end_date,
            limit = 100,
            offset = 0
        } = req.query;

        // ---------- FIX: Convert to integers and validate ----------
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);
        if (isNaN(limitNum) || isNaN(offsetNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid pagination parameters. limit and offset must be numbers.'
            });
        }

        let query = 'SELECT * FROM activity_logs WHERE 1=1';
        const params = [];

        // Add filters
        if (user_id) {
            query += ' AND user_id = ?';
            params.push(user_id);
        }
        if (activity_type) {
            query += ' AND activity_type = ?';
            params.push(activity_type);
        }
        if (resource_type) {
            query += ' AND resource_type = ?';
            params.push(resource_type);
        }
        if (resource_id) {
            query += ' AND resource_id = ?';
            params.push(resource_id);
        }
        if (start_date) {
            query += ' AND timestamp >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND timestamp <= ?';
            params.push(end_date);
        }

        // Add ORDER BY and pagination
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limitNum, offsetNum); // now guaranteed to be numbers

        // ---------- FIX: Use db.query() instead of db.execute() ----------
        const [logs] = await db.query(query, params);
        // db.query is less strict about types; db.execute is for prepared statements.

        res.json({
            success: true,
            data: logs,
            message: `Fetched ${logs.length} activity logs, ordered by timestamp descending.`
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity logs',
            details: error.message
        });
    }
});

module.exports = router;