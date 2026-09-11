const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// ---------- Existing routes ----------

// GET all production records with panel details
router.get('/production-records/all', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                pr.id,
                pr.panel_id,
                pr.reference_number AS production_ref,
                pr.job_no,
                pr.brand,
                pr.estimated_delivery,
                pr.delivery_date,
                pr.number_of_panels,
                pr.balance_after,
                pr.notes,
                pr.status,
                pr.created_at,
                pr.updated_at,
                -- Panel fields
                p.reference_number AS panel_ref,
                p.joint,
                p.type,
                p.panel_thk,
                p.surface_front,
                p.surface_back,
                p.surface_front_thk,
                p.surface_back_thk,
                p.surface_type,
                p.width,
                p.length,
                p.application,
                p.cutting,
                p.qty AS panel_qty,
                p.balance AS panel_balance
            FROM production_records pr
            LEFT JOIN panels p ON pr.panel_id = p.id
            ORDER BY pr.created_at DESC
        `);
        res.json(rows);
        console.log('Fetched all production records with panel data');
    } catch (err) {
        console.error('Error fetching production records with panel data:', err);
        res.status(500).json({ error: 'Failed to fetch production records' });
    }
});

// GET all production records (simple)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM production_records ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching production records:', err);
        res.status(500).json({ error: 'Failed to fetch production records' });
    }
});

// GET a single production record by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM production_records WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Production record not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching production record:', err);
        res.status(500).json({ error: 'Failed to fetch production record' });
    }
});

// POST – create a new production record
router.post('/', async (req, res) => {
    const {
        panel_id,
        reference_number,
        job_no,
        brand,
        estimated_delivery,
        delivery_date,
        number_of_panels,
        balance_after,
        notes,
        status,
    } = req.body;

    if (!panel_id || !reference_number || !number_of_panels) {
        return res.status(400).json({ error: 'panel_id, reference_number, and number_of_panels are required.' });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO production_records 
             (panel_id, reference_number, job_no, brand, estimated_delivery, delivery_date, 
              number_of_panels, balance_after, notes, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [panel_id, reference_number, job_no, brand, estimated_delivery, delivery_date,
             number_of_panels, balance_after, notes, status || 'pending']
        );
        const [newRecord] = await db.query('SELECT * FROM production_records WHERE id = ?', [result.insertId]);
        res.status(201).json(newRecord[0]);
    } catch (err) {
        console.error('Error creating production record:', err);
        res.status(500).json({ error: 'Failed to create production record' });
    }
});

// PUT – update a production record
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        panel_id,
        reference_number,
        job_no,
        brand,
        estimated_delivery,
        delivery_date,
        number_of_panels,
        balance_after,
        notes,
        status,
    } = req.body;

    try {
        const [result] = await db.query(
            `UPDATE production_records SET 
                panel_id = ?, reference_number = ?, job_no = ?, brand = ?, 
                estimated_delivery = ?, delivery_date = ?, 
                number_of_panels = ?, balance_after = ?, notes = ?, status = ?, updated_at = NOW()
             WHERE id = ?`,
            [panel_id, reference_number, job_no, brand, estimated_delivery, delivery_date,
             number_of_panels, balance_after, notes, status, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Production record not found' });
        }
        const [updated] = await db.query('SELECT * FROM production_records WHERE id = ?', [id]);
        res.json(updated[0]);
    } catch (err) {
        console.error('Error updating production record:', err);
        res.status(500).json({ error: 'Failed to update production record' });
    }
});

// DELETE – delete a production record
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM production_records WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Production record not found' });
        }
        res.json({ message: 'Production record deleted successfully' });
    } catch (err) {
        console.error('Error deleting production record:', err);
        res.status(500).json({ error: 'Failed to delete production record' });
    }
});

module.exports = router;