const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// =========================================================
// GET all stock items – no cache
// =========================================================
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                s.id,
                s.quantity,
                s.width,
                s.length,
                s.source,
                s.brand,
                s.panel_id,
                s.created_at,
                s.updated_at,
                -- Panel attributes
                p.reference_number AS panel_ref,
                p.type,
                p.panel_thk,
                p.joint,
                p.surface_front,
                p.surface_back,
                p.surface_front_thk,
                p.surface_back_thk,
                p.surface_type,
                p.application,
                p.cutting,
                p.qty AS panel_qty,
                p.balance AS panel_balance
            FROM stock s
            LEFT JOIN panels p ON s.panel_id = p.id
            ORDER BY s.id DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching stock:', err);
        res.status(500).json({ error: 'Failed to fetch stock' });
    }
});

// =========================================================
// POST – create new stock item
// =========================================================
router.post('/', async (req, res) => {
    const {
        quantity,
        width,
        length,
        source,
        panel_id,
        brand,
    } = req.body;

    // 1. Required fields
    if (!quantity || !width || !length || !source) {
        return res.status(400).json({ error: 'quantity, width, length, and source are required.' });
    }
    if (!['cutting', 'production'].includes(source)) {
        return res.status(400).json({ error: 'Source must be "cutting" or "production".' });
    }

    // 2. If source is 'production', panel_id is mandatory
    if (source === 'production' && !panel_id) {
        return res.status(400).json({ error: 'panel_id is required when source is "production".' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO stock (quantity, width, length, source, panel_id, brand) VALUES (?, ?, ?, ?, ?, ?)',
            [quantity, width, length, source, panel_id || null, brand || null]
        );

        const [newItem] = await db.query(`
            SELECT 
                s.*,
                p.reference_number AS panel_ref,
                p.type,
                p.panel_thk,
                p.joint,
                p.surface_front,
                p.surface_back,
                p.surface_front_thk,
                p.surface_back_thk,
                p.surface_type,
                p.application,
                p.cutting
            FROM stock s
            LEFT JOIN panels p ON s.panel_id = p.id
            WHERE s.id = ?
        `, [result.insertId]);

        res.status(201).json(newItem[0]);
    } catch (err) {
        console.error('Error adding stock:', err);
        res.status(500).json({ error: 'Failed to add stock item' });
    }
});

// =========================================================
// DELETE stock item
// =========================================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM stock WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Stock item not found' });
        }
        res.json({ message: 'Stock item deleted successfully' });
    } catch (err) {
        console.error('Error deleting stock:', err);
        res.status(500).json({ error: 'Failed to delete stock item' });
    }
});

// =========================================================
// PUT – update stock item
// =========================================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        quantity,
        width,
        length,
        source,
        panel_id,
        brand,
    } = req.body;

    // 1. Required fields
    if (!quantity || !width || !length || !source) {
        return res.status(400).json({ error: 'quantity, width, length, and source are required.' });
    }
    if (!['cutting', 'production'].includes(source)) {
        return res.status(400).json({ error: 'Source must be "cutting" or "production".' });
    }

    // 2. If source is 'production', panel_id is mandatory
    if (source === 'production' && !panel_id) {
        return res.status(400).json({ error: 'panel_id is required when source is "production".' });
    }

    try {
        const [result] = await db.query(
            'UPDATE stock SET quantity = ?, width = ?, length = ?, source = ?, panel_id = ?, brand = ? WHERE id = ?',
            [quantity, width, length, source, panel_id || null, brand || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Stock item not found' });
        }

        const [updated] = await db.query(`
            SELECT 
                s.*,
                p.reference_number AS panel_ref,
                p.type,
                p.panel_thk,
                p.joint,
                p.surface_front,
                p.surface_back,
                p.surface_front_thk,
                p.surface_back_thk,
                p.surface_type,
                p.application,
                p.cutting
            FROM stock s
            LEFT JOIN panels p ON s.panel_id = p.id
            WHERE s.id = ?
        `, [id]);

        res.json(updated[0]);
    } catch (err) {
        console.error('Error updating stock:', err);
        res.status(500).json({ error: 'Failed to update stock item' });
    }
});

module.exports = router;