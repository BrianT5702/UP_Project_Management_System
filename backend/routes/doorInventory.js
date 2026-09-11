// routes/doorInventory.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { EventEmitter } = require('events');
const axios = require('axios');
const multer = require('multer');

// ---------- Event Emitter & Telegram ----------
const inventoryEvents = new EventEmitter();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('Telegram credentials missing – notification not sent');
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✅ Telegram low‑stock alert sent');
    } catch (err) {
        console.error('❌ Telegram send failed:', err.message);
    }
}

inventoryEvents.on('lowStock', (item) => {
    const msg = `⚠️ <b>LOW STOCK ALERT</b>\n\n` +
                `Item: ${item.name}\n` +
                `Current quantity: ${item.quantity}\n` +
                `Threshold: 5\n` +
                `Please reorder immediately.`;
    sendTelegramMessage(msg);
});

async function checkAndNotifyLowStock(itemId) {
    const [rows] = await pool.execute(
        'SELECT id, name, quantity FROM door_inventory WHERE id = ?',
        [itemId]
    );
    if (rows.length === 0) return;
    const item = rows[0];
    if (item.quantity < 5) {
        inventoryEvents.emit('lowStock', item);
    }
}

// ---------- Helper: convert BLOB to base64 ----------
const formatInventoryItem = (item) => {
    const result = { ...item };
    if (item.signature_data && item.signature_mimetype) {
        result.signatureData = `data:${item.signature_mimetype};base64,${item.signature_data.toString('base64')}`;
    }
    if (item.image_data && item.image_mimetype) {
        result.imageData = `data:${item.image_mimetype};base64,${item.image_data.toString('base64')}`;
    }
    // Remove raw BLOB fields
    delete result.signature_data;
    delete result.signature_mimetype;
    delete result.signature_date;
    delete result.image_data;
    delete result.image_mimetype;
    delete result.image_date;
    return result;
};

// ---------- CRUD Routes ----------
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM door_inventory ORDER BY name');
        const formatted = rows.map(formatInventoryItem);
        res.json(formatted);
    } catch (err) {
        console.error('Error fetching inventory:', err);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const [rows] = await pool.execute('SELECT * FROM door_inventory WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
        res.json(formatInventoryItem(rows[0]));
    } catch (err) {
        console.error('Error fetching item:', err);
        res.status(500).json({ error: 'Failed to fetch item' });
    }
});

router.post('/', async (req, res) => {
    const { name, quantity = 0, description = null } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const [result] = await pool.execute(
            'INSERT INTO door_inventory (name, quantity, description) VALUES (?, ?, ?)',
            [name.trim(), quantity, description]
        );
        const newId = result.insertId;
        await checkAndNotifyLowStock(newId);
        const [rows] = await pool.execute('SELECT * FROM door_inventory WHERE id = ?', [newId]);
        res.status(201).json(formatInventoryItem(rows[0]));
    } catch (err) {
        console.error('Error creating inventory item:', err);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

router.put('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, quantity, description } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const [existing] = await pool.execute('SELECT id FROM door_inventory WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Item not found' });
        await pool.execute(
            'UPDATE door_inventory SET name = ?, quantity = ?, description = ? WHERE id = ?',
            [name.trim(), quantity, description, id]
        );
        await checkAndNotifyLowStock(id);
        const [rows] = await pool.execute('SELECT * FROM door_inventory WHERE id = ?', [id]);
        res.json(formatInventoryItem(rows[0]));
    } catch (err) {
        console.error('Error updating inventory item:', err);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

router.patch('/:id/quantity', async (req, res) => {
    const id = parseInt(req.params.id);
    const { quantityChange, newQuantity } = req.body;
    if (quantityChange === undefined && newQuantity === undefined) {
        return res.status(400).json({ error: 'Provide quantityChange or newQuantity' });
    }
    try {
        const [rows] = await pool.execute('SELECT quantity FROM door_inventory WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
        let finalQuantity;
        if (quantityChange !== undefined) {
            finalQuantity = rows[0].quantity + quantityChange;
        } else {
            finalQuantity = newQuantity;
        }
        if (finalQuantity < 0) {
            return res.status(400).json({ error: 'Quantity cannot be negative' });
        }
        await pool.execute('UPDATE door_inventory SET quantity = ? WHERE id = ?', [finalQuantity, id]);
        await checkAndNotifyLowStock(id);
        const [updatedRows] = await pool.execute('SELECT * FROM door_inventory WHERE id = ?', [id]);
        res.json(formatInventoryItem(updatedRows[0]));
    } catch (err) {
        console.error('Error updating quantity:', err);
        res.status(500).json({ error: 'Failed to update quantity' });
    }
});

router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const [result] = await pool.execute('DELETE FROM door_inventory WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting inventory item:', err);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// ---------- Media upload endpoints ----------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

router.post('/:id/media', upload.fields([
    { name: 'signature', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]), async (req, res) => {
    const id = parseInt(req.params.id);
    const files = req.files;

    if (!files || (!files.signature && !files.image)) {
        return res.status(400).json({ error: 'At least one file (signature or image) must be uploaded' });
    }

    try {
        const [existing] = await pool.execute('SELECT id FROM door_inventory WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const setClauses = [];
        const values = [];

        if (files.signature) {
            const file = files.signature[0];
            setClauses.push('signature_data = ?, signature_mimetype = ?, signature_date = NOW()');
            values.push(file.buffer, file.mimetype);
        }
        if (files.image) {
            const file = files.image[0];
            setClauses.push('image_data = ?, image_mimetype = ?, image_date = NOW()');
            values.push(file.buffer, file.mimetype);
        }

        const updateSql = `UPDATE door_inventory SET ${setClauses.join(', ')} WHERE id = ?`;
        values.push(id);
        await pool.execute(updateSql, values);

        const [rows] = await pool.execute('SELECT * FROM door_inventory WHERE id = ?', [id]);
        res.json(formatInventoryItem(rows[0]));
    } catch (err) {
        console.error('Error uploading media:', err);
        res.status(500).json({ error: 'Failed to upload media' });
    }
});

router.delete('/:id/image', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const [result] = await pool.execute(
            'UPDATE door_inventory SET image_data = NULL, image_mimetype = NULL, image_date = NULL WHERE id = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const [rows] = await pool.execute('SELECT * FROM door_inventory WHERE id = ?', [id]);
        res.json(formatInventoryItem(rows[0]));
    } catch (err) {
        console.error('Error deleting image:', err);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

router.delete('/:id/signature', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const [result] = await pool.execute(
            'UPDATE door_inventory SET signature_data = NULL, signature_mimetype = NULL, signature_date = NULL WHERE id = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const [rows] = await pool.execute('SELECT * FROM door_inventory WHERE id = ?', [id]);
        res.json(formatInventoryItem(rows[0]));
    } catch (err) {
        console.error('Error deleting signature:', err);
        res.status(500).json({ error: 'Failed to delete signature' });
    }
});

module.exports = router;