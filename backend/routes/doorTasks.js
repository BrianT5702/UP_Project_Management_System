const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { updateProjectCounts } = require('./projectUpdater');
const multer = require('multer');
const auth = require('../middleware/auth');

const TASK_TYPE_PREFIX = 'door';

// ------ Multer setup for image/signature uploads ------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype) return cb(null, true);
        else cb(new Error('Only image files are allowed!'));
    }
});

// ------ Multer for generic file uploads (attachments) ------
const fileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});

// =========================================================
// 🧹 CLEAR MEDIA HELPER (shared)
// =========================================================
async function clearTaskMedia(connection, table, taskIds) {
    if (!taskIds || taskIds.length === 0) return { affected: 0 };
    const placeholders = taskIds.map(() => '?').join(',');

    const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
    const colNames = columns.map(c => c.Field);
    const setClauses = [];

    if (colNames.includes('signature_data')) {
        setClauses.push('signature_data = NULL, signature_mimetype = NULL, signature_date = NULL, signature_uploaded_by = NULL, signature_uploaded_at = NULL');
    }
    if (colNames.includes('signature2_data')) {
        setClauses.push('signature2_data = NULL, signature2_mimetype = NULL, signature2_date = NULL, signature2_uploaded_by = NULL, signature2_uploaded_at = NULL');
    }
    if (colNames.includes('image_data')) {
        setClauses.push('image_data = NULL, image_mimetype = NULL, image_date = NULL, image_uploaded_by = NULL, image_uploaded_at = NULL');
    }

    if (setClauses.length === 0) return { affected: 0 };

    const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`;
    const [result] = await connection.query(query, taskIds);
    return { affected: result.affectedRows };
}

// ------ Format task with uploader details ------
const formatTask = (task) => {
    const result = {
        id: task.id,
        title: task.title,
        description: task.description,
        remark: task.remark,
        priority: task.priority,
        status: task.status,
        projectNo: task.project_no,
        dueDate: task.due_date,
        createdAt: task.created_at,
        // Signature 1
        signatureDate: task.signature_date,
        signatureUploadedBy: task.signature_uploaded_by,
        signatureUploadedAt: task.signature_uploaded_at,
        signatureUploader: task.signature_uploader_username
            ? { id: task.signature_uploaded_by, username: task.signature_uploader_username }
            : null,
        // Signature 2
        signature2Date: task.signature2_date,
        signature2UploadedBy: task.signature2_uploaded_by,
        signature2UploadedAt: task.signature2_uploaded_at,
        signature2Uploader: task.signature2_uploader_username
            ? { id: task.signature2_uploaded_by, username: task.signature2_uploader_username }
            : null,
        // Image
        imageDate: task.image_date,
        imageUploadedBy: task.image_uploaded_by,
        imageUploadedAt: task.image_uploaded_at,
        imageUploader: task.image_uploader_username
            ? { id: task.image_uploaded_by, username: task.image_uploader_username }
            : null,
    };
    if (task.signature_data && task.signature_mimetype) {
        result.signatureUrl = `data:${task.signature_mimetype};base64,${task.signature_data.toString('base64')}`;
    }
    if (task.signature2_data && task.signature2_mimetype) {
        result.signature2Url = `data:${task.signature2_mimetype};base64,${task.signature2_data.toString('base64')}`;
    }
    if (task.image_data && task.image_mimetype) {
        result.imageUrl = `data:${task.image_mimetype};base64,${task.image_data.toString('base64')}`;
    }
    return result;
};

// ------ Fetch a single task with inventory items ------
async function getTaskWithDetails(taskId) {
    const query = `
        SELECT dt.*,
               su.username AS signature_uploader_username,
               su2.username AS signature2_uploader_username,
               iu.username AS image_uploader_username,
               COALESCE(
                   JSON_ARRAYAGG(
                       JSON_OBJECT(
                           'inventory_id', dti.inventory_id,
                           'inventory_name', di.name,
                           'quantity', dti.quantity,
                           'is_checked', dti.is_checked
                       )
                   ),
                   JSON_ARRAY()
               ) as inventory_items
        FROM door_tasks dt
        LEFT JOIN door_task_items dti ON dt.id = dti.task_id
        LEFT JOIN door_inventory di ON dti.inventory_id = di.id
        LEFT JOIN users su ON dt.signature_uploaded_by = su.id
        LEFT JOIN users su2 ON dt.signature2_uploaded_by = su2.id
        LEFT JOIN users iu ON dt.image_uploaded_by = iu.id
        WHERE dt.id = ?
        GROUP BY dt.id
    `;
    const [rows] = await pool.execute(query, [taskId]);
    if (rows.length === 0) return null;
    const task = rows[0];
    const formatted = formatTask(task);
    try {
        formatted.inventoryItems = JSON.parse(task.inventory_items);
    } catch {
        formatted.inventoryItems = [];
    }
    return formatted;
}

// ------ Inventory helpers ------
async function adjustInventoryForTask(taskId, newItems) {
    const [existing] = await pool.execute(
        'SELECT inventory_id, quantity FROM door_task_items WHERE task_id = ?',
        [taskId]
    );
    const existingMap = {};
    existing.forEach(item => existingMap[item.inventory_id] = item.quantity);
    const newMap = {};
    newItems.forEach(item => newMap[item.inventory_id] = item.quantity);

    for (const invId in newMap) {
        if (!existingMap[invId]) {
            await pool.execute(
                'UPDATE door_inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
                [newMap[invId], invId, newMap[invId]]
            );
        } else if (existingMap[invId] !== newMap[invId]) {
            const diff = newMap[invId] - existingMap[invId];
            if (diff > 0) {
                await pool.execute(
                    'UPDATE door_inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
                    [diff, invId, diff]
                );
            } else if (diff < 0) {
                await pool.execute(
                    'UPDATE door_inventory SET quantity = quantity + ? WHERE id = ?',
                    [-diff, invId]
                );
            }
        }
    }
    for (const invId in existingMap) {
        if (!newMap[invId]) {
            await pool.execute(
                'UPDATE door_inventory SET quantity = quantity + ? WHERE id = ?',
                [existingMap[invId], invId]
            );
        }
    }
}

// =========================================================
// 🚚 Transportation Task Helpers
// =========================================================
const createOrUpdateTransportationTaskFromDoor = async (doorTask) => {
    console.log('🚀 Creating/updating transportation for door task:', doorTask.id);
    try {
        let projectId = null;
        const projectNo = doorTask.project_no || doorTask.projectNo;
        if (projectNo) {
            const [projects] = await pool.execute(
                'SELECT id FROM projects WHERE projectNo = ?',
                [projectNo]
            );
            if (projects.length > 0) projectId = projects[0].id;
        }

        const [existing] = await pool.execute(
            'SELECT id FROM transportation_tasks WHERE door_task_id = ?',
            [doorTask.id]
        );

        const title = doorTask.title || 'Transportation Task';
        const description = doorTask.description || null;
        const priority = doorTask.priority || 'empty';
        const dueDate = doorTask.due_date || doorTask.dueDate || null;

        if (existing.length > 0) {
            await pool.execute(
                `UPDATE transportation_tasks 
                 SET status = 'pending', title = ?, description = ?, priority = ?, 
                     project_no = ?, project_id = ?, due_date = ?
                 WHERE door_task_id = ?`,
                [title, description, priority, projectNo, projectId, dueDate, doorTask.id]
            );
        } else {
            await pool.execute(
                `INSERT INTO transportation_tasks 
                 (title, description, priority, status, project_no, project_id, approve_status, due_date, door_task_id, created_at) 
                 VALUES (?, ?, ?, 'pending', ?, ?, 'Approved', ?, ?, NOW())`,
                [title, description, priority, projectNo, projectId, dueDate, doorTask.id]
            );
        }
        console.log(`✅ Transportation task handled for door task ${doorTask.id}`);
    } catch (err) {
        console.error('❌ Failed to create/update transportation task for door:', err.message);
        throw err;
    }
};

const updateTransportationTaskStatusForDoor = async (doorTaskId, newStatus) => {
    try {
        await pool.execute(
            'UPDATE transportation_tasks SET status = ? WHERE door_task_id = ?',
            [newStatus, doorTaskId]
        );
    } catch (err) {
        console.error('Failed to update transportation task status for door:', err);
    }
};

// =========================================================
// GET /api/door-tasks
// =========================================================
router.get('/', auth, async (req, res) => {
    const query = `
        SELECT dt.*,
               su.username AS signature_uploader_username,
               su2.username AS signature2_uploader_username,
               iu.username AS image_uploader_username,
               COALESCE(
                   JSON_ARRAYAGG(
                       JSON_OBJECT(
                           'inventory_id', dti.inventory_id,
                           'inventory_name', di.name,
                           'quantity', dti.quantity,
                           'is_checked', dti.is_checked
                       )
                   ),
                   JSON_ARRAY()
               ) as inventory_items
        FROM door_tasks dt
        LEFT JOIN door_task_items dti ON dt.id = dti.task_id
        LEFT JOIN door_inventory di ON dti.inventory_id = di.id
        LEFT JOIN users su ON dt.signature_uploaded_by = su.id
        LEFT JOIN users su2 ON dt.signature2_uploaded_by = su2.id
        LEFT JOIN users iu ON dt.image_uploaded_by = iu.id
        WHERE dt.approve_status = 'Approved'
        GROUP BY dt.id
        ORDER BY dt.created_at DESC
    `;
    try {
        const [results] = await pool.execute(query);
        const tasks = results.map(task => {
            const formatted = formatTask(task);
            try {
                formatted.inventoryItems = JSON.parse(task.inventory_items);
            } catch {
                formatted.inventoryItems = [];
            }
            return formatted;
        });
        res.json(tasks);
    } catch (err) {
        console.error('Error fetching door tasks:', err);
        return res.status(500).json({ error: 'Failed to fetch door tasks' });
    }
});

// GET /api/door-tasks/:taskId/items
router.get('/:taskId/items', auth, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    try {
        const [rows] = await pool.execute(
            `SELECT ti.*, di.name as inventory_name 
             FROM door_task_items ti
             JOIN door_inventory di ON ti.inventory_id = di.id
             WHERE ti.task_id = ?`,
            [taskId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching task items:', err);
        res.status(500).json({ error: 'Failed to fetch task items' });
    }
});

// PATCH /api/door-tasks/:taskId/items/:inventoryId/check
router.patch('/:taskId/items/:inventoryId/check', auth, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const inventoryId = parseInt(req.params.inventoryId);
    const { is_checked } = req.body;

    if (typeof is_checked !== 'boolean') {
        return res.status(400).json({ error: 'is_checked must be a boolean' });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE door_task_items 
             SET is_checked = ? 
             WHERE task_id = ? AND inventory_id = ?`,
            [is_checked, taskId, inventoryId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Task‑item relation not found' });
        }
        const [rows] = await pool.execute(
            `SELECT ti.*, di.name as inventory_name 
             FROM door_task_items ti
             JOIN door_inventory di ON ti.inventory_id = di.id
             WHERE ti.task_id = ? AND ti.inventory_id = ?`,
            [taskId, inventoryId]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('Error toggling item check:', err);
        res.status(500).json({ error: 'Failed to update item check status' });
    }
});

// =========================================================
// POST /api/door-tasks
// =========================================================
router.post('/', auth, async (req, res) => {
    const { title, description, remark, priority, status, project_no, due_date, items } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }
    if (!project_no || !project_no.trim()) {
        return res.status(400).json({ error: 'Project No is required' });
    }
    const sanitizedDescription = description ?? null;
    const sanitizedRemark = remark ?? null;
    const sanitizedDueDate = due_date ?? null;
    const initialStatus = status || 'pending';

    const insertSql = `
        INSERT INTO door_tasks 
        (title, description, remark, priority, status, project_no, due_date, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    try {
        const [insertResults] = await pool.execute(insertSql, [
            title, sanitizedDescription, sanitizedRemark, priority, initialStatus, project_no, sanitizedDueDate
        ]);
        const taskId = insertResults.insertId;
        await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'total', 1);
        if (initialStatus.toLowerCase() === 'completed') {
            await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'completed', 1);
        }

        // Handle inventory items
        if (items && Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                const { inventory_id, quantity } = item;
                if (!inventory_id || !quantity || quantity <= 0) continue;
                await pool.execute(
                    'INSERT INTO door_task_items (task_id, inventory_id, quantity) VALUES (?, ?, ?)',
                    [taskId, inventory_id, quantity]
                );
                await pool.execute(
                    'UPDATE door_inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
                    [quantity, inventory_id, quantity]
                );
            }
        }

        const [rawRows] = await pool.execute('SELECT * FROM door_tasks WHERE id = ?', [taskId]);
        if (rawRows.length === 0) {
            return res.status(500).json({ error: 'Task created but failed to fetch.' });
        }
        if (initialStatus.toLowerCase() === 'completed') {
            await createOrUpdateTransportationTaskFromDoor(rawRows[0]);
        }

        const createdTask = await getTaskWithDetails(taskId);
        if (!createdTask) {
            return res.status(500).json({ error: 'Task created but failed to fetch details.' });
        }
        res.status(201).json(createdTask);
    } catch (err) {
        console.error('Error creating door task:', err);
        return res.status(500).json({ error: 'Failed to create door task' });
    }
});

// =========================================================
// PATCH /api/door-tasks/:id
// =========================================================
router.patch('/:id', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    const updates = req.body;
    const { items, ...taskUpdates } = updates;

    if (Object.keys(taskUpdates).length === 0 && items === undefined && !updates.clearImage && !updates.clearSignature1 && !updates.clearSignature2) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    let previousTask;
    try {
        const [existingRows] = await pool.execute(
            'SELECT project_no, status FROM door_tasks WHERE id = ?',
            [taskId]
        );
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        previousTask = existingRows[0];
    } catch (err) {
        console.error('Error fetching existing task:', err);
        return res.status(500).json({ error: 'Database error before update' });
    }

    // Build dynamic SET clause for text fields (including remark)
    const allowedFields = ['title', 'description', 'remark', 'priority', 'status', 'project_no', 'due_date'];
    const fieldsToUpdate = [];
    const updateValues = [];
    for (const field of allowedFields) {
        if (taskUpdates[field] !== undefined) {
            fieldsToUpdate.push(`${field} = ?`);
            const value = (taskUpdates[field] === '' && (field === 'description' || field === 'remark' || field === 'due_date'))
                            ? null : taskUpdates[field];
            updateValues.push(value);
        }
    }

    const clearImage = updates.clearImage === true;
    const clearSignature1 = updates.clearSignature1 === true;
    const clearSignature2 = updates.clearSignature2 === true;

    if (clearImage) {
        fieldsToUpdate.push('image_data = NULL, image_mimetype = NULL, image_date = NULL, image_uploaded_by = NULL, image_uploaded_at = NULL');
    }
    if (clearSignature1) {
        fieldsToUpdate.push('signature_data = NULL, signature_mimetype = NULL, signature_date = NULL, signature_uploaded_by = NULL, signature_uploaded_at = NULL');
    }
    if (clearSignature2) {
        fieldsToUpdate.push('signature2_data = NULL, signature2_mimetype = NULL, signature2_date = NULL, signature2_uploaded_by = NULL, signature2_uploaded_at = NULL');
    }

    // Determine new status before updating
    const newStatus = taskUpdates.status ? taskUpdates.status.toLowerCase() : previousTask.status.toLowerCase();

    // If new status is on-hold, force clear all media (even if frontend didn't ask)
    if (newStatus === 'on-hold') {
        fieldsToUpdate.push('image_data = NULL, image_mimetype = NULL, image_date = NULL, image_uploaded_by = NULL, image_uploaded_at = NULL');
        fieldsToUpdate.push('signature_data = NULL, signature_mimetype = NULL, signature_date = NULL, signature_uploaded_by = NULL, signature_uploaded_at = NULL');
        fieldsToUpdate.push('signature2_data = NULL, signature2_mimetype = NULL, signature2_date = NULL, signature2_uploaded_by = NULL, signature2_uploaded_at = NULL');
    }

    if (fieldsToUpdate.length > 0) {
        const setClause = fieldsToUpdate.join(', ');
        const updateSql = `UPDATE door_tasks SET ${setClause} WHERE id = ?`;
        const finalBindValues = [...updateValues, taskId];
        await pool.execute(updateSql, finalBindValues);
    }

    // Update project counts if status changed
    if (taskUpdates.status) {
        const oldStatus = previousTask.status.toLowerCase();
        if (newStatus === 'completed' && oldStatus !== 'completed') {
            await updateProjectCounts(previousTask.project_no, TASK_TYPE_PREFIX, 'completed', 1);
        } else if (newStatus !== 'completed' && oldStatus === 'completed') {
            await updateProjectCounts(previousTask.project_no, TASK_TYPE_PREFIX, 'completed', -1);
        }
    }

    // Handle inventory items update
    if (items !== undefined) {
        if (items && Array.isArray(items) && items.length > 0) {
            await adjustInventoryForTask(taskId, items);
            await pool.execute('DELETE FROM door_task_items WHERE task_id = ?', [taskId]);
            for (const item of items) {
                const { inventory_id, quantity } = item;
                if (!inventory_id || !quantity || quantity <= 0) continue;
                await pool.execute(
                    'INSERT INTO door_task_items (task_id, inventory_id, quantity) VALUES (?, ?, ?)',
                    [taskId, inventory_id, quantity]
                );
            }
        } else {
            // Remove all items – restore inventory
            const [existing] = await pool.execute(
                'SELECT inventory_id, quantity FROM door_task_items WHERE task_id = ?',
                [taskId]
            );
            for (const item of existing) {
                await pool.execute(
                    'UPDATE door_inventory SET quantity = quantity + ? WHERE id = ?',
                    [item.quantity, item.inventory_id]
                );
            }
            await pool.execute('DELETE FROM door_task_items WHERE task_id = ?', [taskId]);
        }
    }

    const [rawRows] = await pool.execute('SELECT * FROM door_tasks WHERE id = ?', [taskId]);
    if (rawRows.length === 0) {
        return res.status(404).json({ error: 'Task not found after update' });
    }
    const rawTask = rawRows[0];

    const oldStatus = previousTask.status.toLowerCase();

    try {
        if (oldStatus !== 'completed' && newStatus === 'completed') {
            await createOrUpdateTransportationTaskFromDoor(rawTask);
        } else if (newStatus === 'on-hold' || (oldStatus === 'completed' && newStatus !== 'completed')) {
            await updateTransportationTaskStatusForDoor(taskId, 'on-hold');
            // Also clear media on the transportation task(s)
            const [transportIds] = await pool.execute(
                'SELECT id FROM transportation_tasks WHERE door_task_id = ?',
                [taskId]
            );
            if (transportIds.length > 0) {
                const ids = transportIds.map(r => r.id);
                await clearTaskMedia(pool, 'transportation_tasks', ids);
            }
        }
    } catch (err) {
        console.error('❌ Failed to handle transportation task:', err);
        return res.status(500).json({ error: 'Failed to update transportation task' });
    }

    const updatedTask = await getTaskWithDetails(taskId);
    if (!updatedTask) {
        return res.status(404).json({ error: 'Task not found after update' });
    }
    res.json(updatedTask);
});

// =========================================================
// SIGNATURE 1 endpoints (with cross-user check)
// =========================================================
router.post('/:id/signature1', auth, upload.single('signature'), async (req, res) => {
    console.log(`POST /api/door-tasks/${req.params.id}/signature1 called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No signature file uploaded' });
    }

    try {
        const [taskRows] = await pool.execute(
            'SELECT signature2_uploaded_by FROM door_tasks WHERE id = ?',
            [taskId]
        );
        if (taskRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const otherUploader = taskRows[0].signature2_uploaded_by;
        if (otherUploader !== null && otherUploader === userId) {
            return res.status(403).json({
                error: 'Same user cannot sign both signatures. Signature 2 already uploaded by you.'
            });
        }

        const signatureData = req.file.buffer;
        const signatureMimetype = req.file.mimetype;

        const updateSql = `
            UPDATE door_tasks 
            SET signature_data = ?, 
                signature_mimetype = ?, 
                signature_date = NOW(),
                signature_uploaded_by = ?,
                signature_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [signatureData, signatureMimetype, userId, taskId]);

        const updatedTask = await getTaskWithDetails(taskId);
        if (!updatedTask) {
            return res.status(500).json({ error: 'Task updated but failed to fetch.' });
        }
        res.json(updatedTask);
    } catch (err) {
        console.error('Error uploading signature 1:', err);
        return res.status(500).json({ error: 'Failed to upload signature 1' });
    }
});

router.delete('/:id/signature1', auth, async (req, res) => {
    console.log(`DELETE /api/door-tasks/${req.params.id}/signature1 called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM door_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE door_tasks 
            SET signature_data = NULL, 
                signature_mimetype = NULL, 
                signature_date = NULL,
                signature_uploaded_by = NULL,
                signature_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const updatedTask = await getTaskWithDetails(taskId);
        if (!updatedTask) {
            return res.status(500).json({ error: 'Task updated but failed to fetch.' });
        }
        res.json(updatedTask);
    } catch (err) {
        console.error('Error deleting signature 1:', err);
        return res.status(500).json({ error: 'Failed to delete signature 1' });
    }
});

// =========================================================
// SIGNATURE 2 endpoints (with cross-user check)
// =========================================================
router.post('/:id/signature2', auth, upload.single('signature'), async (req, res) => {
    console.log(`POST /api/door-tasks/${req.params.id}/signature2 called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No signature file uploaded' });
    }

    try {
        const [taskRows] = await pool.execute(
            'SELECT signature_uploaded_by FROM door_tasks WHERE id = ?',
            [taskId]
        );
        if (taskRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const otherUploader = taskRows[0].signature_uploaded_by;
        if (otherUploader !== null && otherUploader === userId) {
            return res.status(403).json({
                error: 'Same user cannot sign both signatures. Signature 1 already uploaded by you.'
            });
        }

        const signatureData = req.file.buffer;
        const signatureMimetype = req.file.mimetype;

        const updateSql = `
            UPDATE door_tasks 
            SET signature2_data = ?, 
                signature2_mimetype = ?, 
                signature2_date = NOW(),
                signature2_uploaded_by = ?,
                signature2_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [signatureData, signatureMimetype, userId, taskId]);

        const updatedTask = await getTaskWithDetails(taskId);
        if (!updatedTask) {
            return res.status(500).json({ error: 'Task updated but failed to fetch.' });
        }
        res.json(updatedTask);
    } catch (err) {
        console.error('Error uploading signature 2:', err);
        return res.status(500).json({ error: 'Failed to upload signature 2' });
    }
});

router.delete('/:id/signature2', auth, async (req, res) => {
    console.log(`DELETE /api/door-tasks/${req.params.id}/signature2 called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM door_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE door_tasks 
            SET signature2_data = NULL, 
                signature2_mimetype = NULL, 
                signature2_date = NULL,
                signature2_uploaded_by = NULL,
                signature2_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const updatedTask = await getTaskWithDetails(taskId);
        if (!updatedTask) {
            return res.status(500).json({ error: 'Task updated but failed to fetch.' });
        }
        res.json(updatedTask);
    } catch (err) {
        console.error('Error deleting signature 2:', err);
        return res.status(500).json({ error: 'Failed to delete signature 2' });
    }
});

// =========================================================
// IMAGE endpoints (separate)
// =========================================================
router.post('/:id/image', auth, upload.single('image'), async (req, res) => {
    console.log(`POST /api/door-tasks/${req.params.id}/image called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
    }

    try {
        const updateSql = `
            UPDATE door_tasks 
            SET image_data = ?, 
                image_mimetype = ?, 
                image_date = NOW(),
                image_uploaded_by = ?,
                image_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [req.file.buffer, req.file.mimetype, userId, taskId]);

        const updatedTask = await getTaskWithDetails(taskId);
        if (!updatedTask) {
            return res.status(500).json({ error: 'Task updated but failed to fetch.' });
        }
        res.json(updatedTask);
    } catch (err) {
        console.error('Error uploading image:', err);
        return res.status(500).json({ error: 'Failed to upload image' });
    }
});

router.delete('/:id/image', auth, async (req, res) => {
    console.log(`DELETE /api/door-tasks/${req.params.id}/image called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM door_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE door_tasks 
            SET image_data = NULL, 
                image_mimetype = NULL, 
                image_date = NULL,
                image_uploaded_by = NULL,
                image_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const updatedTask = await getTaskWithDetails(taskId);
        if (!updatedTask) {
            return res.status(500).json({ error: 'Task updated but failed to fetch.' });
        }
        res.json(updatedTask);
    } catch (err) {
        console.error('Error deleting image:', err);
        return res.status(500).json({ error: 'Failed to delete image' });
    }
});

// =========================================================
// POST /api/door-tasks/:id/media (legacy – upload signature1 + image)
// =========================================================
router.post('/:id/media', auth, upload.fields([
    { name: 'signature', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]), async (req, res) => {
    console.log(`POST /api/door-tasks/${req.params.id}/media called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;
    const files = req.files;

    if (!files || (!files.signature && !files.image)) {
        return res.status(400).json({ error: 'At least one file (signature or image) must be uploaded' });
    }

    try {
        if (files.signature) {
            const [taskRows] = await pool.execute(
                'SELECT signature2_uploaded_by FROM door_tasks WHERE id = ?',
                [taskId]
            );
            if (taskRows.length > 0 && taskRows[0].signature2_uploaded_by === userId) {
                return res.status(403).json({
                    error: 'Same user cannot sign both signatures. Signature 2 already uploaded by you.'
                });
            }
        }

        const setClauses = [];
        const values = [];

        if (files.signature) {
            const sig = files.signature[0];
            setClauses.push('signature_data = ?, signature_mimetype = ?, signature_date = NOW(), signature_uploaded_by = ?, signature_uploaded_at = NOW()');
            values.push(sig.buffer, sig.mimetype, userId);
        }
        if (files.image) {
            const img = files.image[0];
            setClauses.push('image_data = ?, image_mimetype = ?, image_date = NOW(), image_uploaded_by = ?, image_uploaded_at = NOW()');
            values.push(img.buffer, img.mimetype, userId);
        }

        const updateSql = `UPDATE door_tasks SET ${setClauses.join(', ')} WHERE id = ?`;
        values.push(taskId);
        await pool.execute(updateSql, values);

        const updatedTask = await getTaskWithDetails(taskId);
        if (!updatedTask) {
            return res.status(500).json({ error: 'Task updated but failed to fetch.' });
        }
        res.json(updatedTask);
    } catch (err) {
        console.error('Error uploading media:', err);
        res.status(500).json({ error: 'Failed to upload media' });
    }
});

// =========================================================
// DELETE /api/door-tasks/:id
// =========================================================
router.delete('/:id', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    let taskToDelete;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            'SELECT project_id, project_no, status FROM door_tasks WHERE id = ?',
            [taskId]
        );
        if (existingRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Task not found' });
        }
        taskToDelete = existingRows[0];

        // Delete linked files
        const [fileRows] = await connection.execute(
            'SELECT id FROM project_files WHERE taskNo = ?',
            [taskId]
        );
        if (fileRows.length > 0) {
            const fileIds = fileRows.map(f => f.id);
            const placeholders = fileIds.map(() => '?').join(',');
            await connection.execute(
                `DELETE FROM project_files WHERE id IN (${placeholders})`,
                fileIds
            );
        }

        // Delete inventory items and restore stock
        const [items] = await connection.execute(
            'SELECT inventory_id, quantity FROM door_task_items WHERE task_id = ?',
            [taskId]
        );
        for (const item of items) {
            await connection.execute(
                'UPDATE door_inventory SET quantity = quantity + ? WHERE id = ?',
                [item.quantity, item.inventory_id]
            );
        }
        await connection.execute('DELETE FROM door_task_items WHERE task_id = ?', [taskId]);

        const [deleteResult] = await connection.execute(
            'DELETE FROM door_tasks WHERE id = ?',
            [taskId]
        );
        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Task not found' });
        }

        await updateProjectCounts(taskToDelete.project_no, TASK_TYPE_PREFIX, 'total', -1);
        if (taskToDelete.status && taskToDelete.status.toLowerCase() === 'completed') {
            await updateProjectCounts(taskToDelete.project_no, TASK_TYPE_PREFIX, 'completed', -1);
        }

        await connection.commit();
        res.status(200).json({
            message: 'Door task and linked files deleted successfully',
            taskId,
            project_no: taskToDelete.project_no,
            filesDeleted: fileRows.length
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(`Error deleting door task:`, err);
        return res.status(500).json({ error: 'Failed to delete task and its files' });
    } finally {
        if (connection) connection.release();
    }
});

// =========================================================
// FILE ATTACHMENT ENDPOINTS
// =========================================================
router.get('/:id/files', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    try {
        const [existing] = await pool.execute('SELECT id FROM door_tasks WHERE id = ?', [taskId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Door task not found' });
        }
        const [files] = await pool.execute(
            `SELECT id, file_name AS fileName, file_size AS fileSize, 
                    mime_type AS fileType, category AS taskType, taskNo,
                    created_at AS uploadedAt, project_id
             FROM project_files
             WHERE category = 'door' AND taskNo = ?
             ORDER BY created_at DESC`,
            [taskId]
        );
        const filesWithUploader = files.map(file => ({ ...file, uploadedBy: null }));
        res.json(filesWithUploader);
    } catch (err) {
        console.error('Error fetching door task files:', err);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

router.post('/:id/files', auth, fileUpload.single('file'), async (req, res) => {
    const taskId = parseInt(req.params.id);
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        const [taskExists] = await pool.execute(
            'SELECT id, project_id FROM door_tasks WHERE id = ?',
            [taskId]
        );
        if (taskExists.length === 0) {
            return res.status(404).json({ error: 'Door task not found' });
        }
        const projectId = taskExists[0].project_id;
        const insertSql = `
            INSERT INTO project_files
            (file_name, file_data, file_size, mime_type, category, taskNo, project_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await pool.execute(insertSql, [
            req.file.originalname, req.file.buffer, req.file.size,
            req.file.mimetype, 'door', taskId, projectId || null
        ]);
        res.status(201).json({
            message: 'File uploaded successfully',
            fileId: result.insertId,
            fileName: req.file.originalname,
        });
    } catch (err) {
        console.error('Error uploading file to door task:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

router.delete('/:id/files/:fileId', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    const fileId = parseInt(req.params.fileId);
    try {
        const [fileRows] = await pool.execute(
            'SELECT id FROM project_files WHERE id = ? AND category = ? AND taskNo = ?',
            [fileId, 'door', taskId]
        );
        if (fileRows.length === 0) {
            return res.status(404).json({ error: 'File not found for this task' });
        }
        await pool.execute('DELETE FROM project_files WHERE id = ?', [fileId]);
        res.json({ message: 'File deleted successfully' });
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

module.exports = router;