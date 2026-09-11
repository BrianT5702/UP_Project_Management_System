const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { updateProjectCounts } = require('./projectUpdater');
const multer = require('multer');
const auth = require('../middleware/auth');

const TASK_TYPE_PREFIX = 'panel';

// Configure multer – increased limit to 20MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
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

// =========================================================
// 🧹 EXPLICIT MEDIA CLEARING (hardcoded columns)
// =========================================================
async function clearPanelTaskMedia(connection, taskIds) {
    if (!taskIds || taskIds.length === 0) return { affected: 0 };
    const placeholders = taskIds.map(() => '?').join(',');
    const query = `
        UPDATE panel_tasks SET
            signature_data = NULL,
            signature_mimetype = NULL,
            signature_date = NULL,
            signature_uploaded_by = NULL,
            signature_uploaded_at = NULL,
            signature2_data = NULL,
            signature2_mimetype = NULL,
            signature2_date = NULL,
            signature2_uploaded_by = NULL,
            signature2_uploaded_at = NULL,
            image_data = NULL,
            image_mimetype = NULL,
            image_date = NULL,
            image_uploaded_by = NULL,
            image_uploaded_at = NULL
        WHERE id IN (${placeholders})
    `;
    const [result] = await connection.query(query, taskIds);
    return { affected: result.affectedRows };
}

async function clearCuttingTaskMedia(connection, taskIds) {
    if (!taskIds || taskIds.length === 0) return { affected: 0 };
    const placeholders = taskIds.map(() => '?').join(',');
    const query = `
        UPDATE cutting_tasks SET
            signature_data = NULL,
            signature_mimetype = NULL,
            signature_date = NULL,
            signature_uploaded_by = NULL,
            signature_uploaded_at = NULL,
            signature2_data = NULL,
            signature2_mimetype = NULL,
            signature2_date = NULL,
            signature2_uploaded_by = NULL,
            signature2_uploaded_at = NULL,
            image_data = NULL,
            image_mimetype = NULL,
            image_date = NULL,
            image_uploaded_by = NULL,
            image_uploaded_at = NULL
        WHERE id IN (${placeholders})
    `;
    const [result] = await connection.query(query, taskIds);
    return { affected: result.affectedRows };
}

async function clearTransportationTaskMedia(connection, taskIds) {
    if (!taskIds || taskIds.length === 0) return { affected: 0 };
    const placeholders = taskIds.map(() => '?').join(',');
    const query = `
        UPDATE transportation_tasks SET
            signature_data = NULL,
            signature_mimetype = NULL,
            signature_date = NULL,
            signature_uploaded_by = NULL,
            signature_uploaded_at = NULL,
            signature2_data = NULL,
            signature2_mimetype = NULL,
            signature2_date = NULL,
            signature2_uploaded_by = NULL,
            signature2_uploaded_at = NULL,
            image_data = NULL,
            image_mimetype = NULL,
            image_date = NULL,
            image_uploaded_by = NULL,
            image_uploaded_at = NULL
        WHERE id IN (${placeholders})
    `;
    const [result] = await connection.query(query, taskIds);
    return { affected: result.affectedRows };
}

// =========================================================
// Utility: format task with uploader details (BOTH signatures)
// =========================================================
const formatTask = (task) => {
    const result = {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        projectNo: task.project_no,
        dueDate: task.due_date,
        createdAt: task.created_at,
        signatureDate: task.signature_date,
        signatureUploadedBy: task.signature_uploaded_by,
        signatureUploadedAt: task.signature_uploaded_at,
        signatureUploader: task.signature_uploader_username
            ? { id: task.signature_uploaded_by, username: task.signature_uploader_username }
            : null,
        signature2Date: task.signature2_date,
        signature2UploadedBy: task.signature2_uploaded_by,
        signature2UploadedAt: task.signature2_uploaded_at,
        signature2Uploader: task.signature2_uploader_username
            ? { id: task.signature2_uploaded_by, username: task.signature2_uploader_username }
            : null,
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

// =========================================================
// 🔄 CASCADE HELPER – updates cutting/transportation statuses AND clears their media if target is on-hold
// =========================================================
async function cascadePanelStatus(connection, panelTaskId, panelStatus, projectNo) {
    const result = { cuttingUpdated: false, transportationUpdated: false, mediaCleared: false };
    let targetStatus;
    if (panelStatus.toLowerCase() === 'cutting') {
        targetStatus = 'pending';
    } else {
        targetStatus = 'on-hold';
    }

    try {
        // 1. Find linked cutting task
        const [cuttingRows] = await connection.execute(
            'SELECT id FROM cutting_tasks WHERE panel_task_id = ?',
            [panelTaskId]
        );
        if (cuttingRows.length > 0) {
            const cuttingId = cuttingRows[0].id;
            await connection.execute(
                'UPDATE cutting_tasks SET status = ? WHERE id = ?',
                [targetStatus, cuttingId]
            );
            result.cuttingUpdated = true;

            if (targetStatus === 'on-hold') {
                await clearCuttingTaskMedia(connection, [cuttingId]);
                result.mediaCleared = true;
            }

            // 2. Find linked transportation via cutting
            const [transportRows] = await connection.execute(
                'SELECT id FROM transportation_tasks WHERE cutting_task_id = ?',
                [cuttingId]
            );
            if (transportRows.length > 0) {
                const transportId = transportRows[0].id;
                await connection.execute(
                    'UPDATE transportation_tasks SET status = ? WHERE id = ?',
                    [targetStatus, transportId]
                );
                result.transportationUpdated = true;
                if (targetStatus === 'on-hold') {
                    await clearTransportationTaskMedia(connection, [transportId]);
                }
            }
        }

        // 3. Direct panel → transportation links
        const [directTransportRows] = await connection.execute(
            'SELECT id FROM transportation_tasks WHERE panel_task_id = ?',
            [panelTaskId]
        );
        if (directTransportRows.length > 0) {
            const ids = directTransportRows.map(r => r.id);
            const placeholders = ids.map(() => '?').join(',');
            await connection.execute(
                `UPDATE transportation_tasks SET status = ? WHERE id IN (${placeholders})`,
                [targetStatus, ...ids]
            );
            result.transportationUpdated = true;
            if (targetStatus === 'on-hold') {
                await clearTransportationTaskMedia(connection, ids);
            }
        }

        console.log(
            `✅ Cascaded panel status '${panelStatus}' → cutting/transportation status '${targetStatus}' ` +
            `for panel task ${panelTaskId}, project ${projectNo}`
        );
    } catch (err) {
        console.warn(`⚠️ Cascade failed for panel task ${panelTaskId}:`, err.message);
    }
    return result;
}

// =========================================================
// GET /api/panel-tasks
// =========================================================
router.get('/', auth, async (req, res) => {
    console.log('GET /api/panel-tasks called (authenticated)');
    const query = `
        SELECT 
            pt.*,
            su.username AS signature_uploader_username,
            su2.username AS signature2_uploader_username,
            iu.username AS image_uploader_username
        FROM panel_tasks pt
        LEFT JOIN users su ON pt.signature_uploaded_by = su.id
        LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
        LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
        WHERE pt.approve_status = 'Approved'
        ORDER BY pt.created_at DESC
    `;
    try {
        const [results] = await pool.execute(query);
        res.json(results.map(formatTask));
    } catch (err) {
        console.error('Error fetching approved panel tasks:', err);
        return res.status(500).json({ error: 'Failed to fetch approved panel tasks' });
    }
});

// =========================================================
// POST /api/panel-tasks
// =========================================================
router.post('/', auth, async (req, res) => {
    console.log('POST /api/panel-tasks called');
    const { title, description, priority, status, project_no, due_date } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }
    if (!project_no || !project_no.trim()) {
        return res.status(400).json({ error: 'Project No is required' });
    }

    const sanitizedDescription = description?.trim() || null;
    const sanitizedPriority = priority || 'empty';
    const sanitizedStatus = status || 'pending';
    const sanitizedDueDate = due_date || null;

    const insertSql = `
        INSERT INTO panel_tasks 
        (title, description, priority, status, project_no, due_date, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    const bindValues = [title, sanitizedDescription, sanitizedPriority, sanitizedStatus, project_no, sanitizedDueDate];

    try {
        const [insertResults] = await pool.execute(insertSql, bindValues);
        const insertId = insertResults.insertId;

        await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'total', 1);
        if (sanitizedStatus === 'cutting') {
            await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'completed', 1);
            console.log(`✅ Incremented completed count for project ${project_no} (task created as cutting)`);
        }

        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [insertId]);
        res.status(201).json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error creating panel task:', err);
        return res.status(500).json({ error: 'Failed to create panel task' });
    }
});

// =========================================================
// PATCH /api/panel-tasks/:id – UPDATED with explicit media clearing
// =========================================================
router.patch('/:id', auth, async (req, res) => {
    console.log(`PATCH /api/panel-tasks/${req.params.id} called`);
    const taskId = parseInt(req.params.id);
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Request body must contain fields to update.' });
    }

    let previousTask;
    try {
        const [existingRows] = await pool.execute('SELECT project_no, status FROM panel_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        previousTask = existingRows[0];
    } catch (err) {
        console.error('Error fetching existing task:', err);
        return res.status(500).json({ error: 'Database error before update' });
    }

    const oldStatus = previousTask.status.toLowerCase();
    const newStatus = updates.status ? updates.status.toLowerCase() : oldStatus;

    console.log(`Status change: ${oldStatus} → ${newStatus}`);

    // Update project counts (completed)
    if (oldStatus !== 'cutting' && newStatus === 'cutting') {
        await updateProjectCounts(previousTask.project_no, TASK_TYPE_PREFIX, 'completed', 1);
        console.log(`✅ Incremented completed for project ${previousTask.project_no}`);
    } else if (oldStatus === 'cutting' && newStatus !== 'cutting') {
        await updateProjectCounts(previousTask.project_no, TASK_TYPE_PREFIX, 'completed', -1);
        console.log(`✅ Decremented completed for project ${previousTask.project_no}`);
    }

    const allowedFields = ['title', 'description', 'priority', 'status', 'project_no', 'due_date'];
    const fieldsToUpdate = [];
    const updateValues = [];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            fieldsToUpdate.push(`${field} = ?`);
            const value = (updates[field] === '' && (field === 'description' || field === 'due_date'))
                ? null : updates[field];
            updateValues.push(value);
        }
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const setClause = fieldsToUpdate.join(', ');
    const updateSql = `UPDATE panel_tasks SET ${setClause} WHERE id = ?`;
    const finalBindValues = [...updateValues, taskId];

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Update the panel task
        await connection.execute(updateSql, finalBindValues);

        // 2. If new status is on-hold, clear ALL media on the panel task itself (explicitly)
        if (newStatus === 'on-hold') {
            await clearPanelTaskMedia(connection, [taskId]);
            console.log(`🧹 Cleared all media for panel task ${taskId}`);
        }

        // 3. Cascade to downstream tasks (cutting / transportation) and clear their media if on-hold
        if (oldStatus !== newStatus) {
            await cascadePanelStatus(connection, taskId, newStatus, previousTask.project_no);
        }

        await connection.commit();
        connection.release();

        // Fetch and return updated task
        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found after update' });
        }

        res.json(formatTask(rows[0]));
    } catch (err) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Error updating task:', err);
        return res.status(500).json({ error: 'Failed to update task: ' + err.message });
    }
});

// =========================================================
// SIGNATURE 1 endpoints
// =========================================================
router.post('/:id/signature1', auth, upload.single('signature'), async (req, res) => {
    console.log(`POST /api/panel-tasks/${req.params.id}/signature1 called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No signature file uploaded' });
    }

    try {
        const [taskRows] = await pool.execute(
            'SELECT signature2_uploaded_by FROM panel_tasks WHERE id = ?',
            [taskId]
        );
        if (taskRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (taskRows[0].signature2_uploaded_by === userId) {
            return res.status(403).json({
                error: 'You already uploaded Signature 2. Only one signature per user is allowed.'
            });
        }

        const signatureData = req.file.buffer;
        const signatureMimetype = req.file.mimetype;

        const updateSql = `
            UPDATE panel_tasks 
            SET signature_data = ?, 
                signature_mimetype = ?, 
                signature_date = NOW(),
                signature_uploaded_by = ?,
                signature_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [signatureData, signatureMimetype, userId, taskId]);

        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error uploading signature 1:', err);
        return res.status(500).json({ error: 'Failed to upload signature 1' });
    }
});

router.delete('/:id/signature1', auth, async (req, res) => {
    console.log(`DELETE /api/panel-tasks/${req.params.id}/signature1 called`);
    const taskId = parseInt(req.params.id);

    try {
        const [existingRows] = await pool.execute('SELECT id FROM panel_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const updateSql = `
            UPDATE panel_tasks 
            SET signature_data = NULL, 
                signature_mimetype = NULL, 
                signature_date = NULL,
                signature_uploaded_by = NULL,
                signature_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error deleting signature 1:', err);
        return res.status(500).json({ error: 'Failed to delete signature 1' });
    }
});

// =========================================================
// SIGNATURE 2 endpoints
// =========================================================
router.post('/:id/signature2', auth, upload.single('signature'), async (req, res) => {
    console.log(`POST /api/panel-tasks/${req.params.id}/signature2 called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No signature file uploaded' });
    }

    try {
        const [taskRows] = await pool.execute(
            'SELECT signature_uploaded_by FROM panel_tasks WHERE id = ?',
            [taskId]
        );
        if (taskRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (taskRows[0].signature_uploaded_by === userId) {
            return res.status(403).json({
                error: 'You already uploaded Signature 1. Only one signature per user is allowed.'
            });
        }

        const signatureData = req.file.buffer;
        const signatureMimetype = req.file.mimetype;

        const updateSql = `
            UPDATE panel_tasks 
            SET signature2_data = ?, 
                signature2_mimetype = ?, 
                signature2_date = NOW(),
                signature2_uploaded_by = ?,
                signature2_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [signatureData, signatureMimetype, userId, taskId]);

        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error uploading signature 2:', err);
        return res.status(500).json({ error: 'Failed to upload signature 2' });
    }
});

router.delete('/:id/signature2', auth, async (req, res) => {
    console.log(`DELETE /api/panel-tasks/${req.params.id}/signature2 called`);
    const taskId = parseInt(req.params.id);

    try {
        const [existingRows] = await pool.execute('SELECT id FROM panel_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const updateSql = `
            UPDATE panel_tasks 
            SET signature2_data = NULL, 
                signature2_mimetype = NULL, 
                signature2_date = NULL,
                signature2_uploaded_by = NULL,
                signature2_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error deleting signature 2:', err);
        return res.status(500).json({ error: 'Failed to delete signature 2' });
    }
});

// =========================================================
// IMAGE endpoints
// =========================================================
router.post('/:id/image', auth, upload.single('image'), async (req, res) => {
    console.log(`POST /api/panel-tasks/${req.params.id}/image called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
    }

    const imageData = req.file.buffer;
    const imageMimetype = req.file.mimetype;

    try {
        const updateSql = `
            UPDATE panel_tasks 
            SET image_data = ?, 
                image_mimetype = ?, 
                image_date = NOW(),
                image_uploaded_by = ?,
                image_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [imageData, imageMimetype, userId, taskId]);

        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error uploading image:', err);
        return res.status(500).json({ error: 'Failed to upload image' });
    }
});

router.delete('/:id/image', auth, async (req, res) => {
    console.log(`DELETE /api/panel-tasks/${req.params.id}/image called`);
    const taskId = parseInt(req.params.id);

    try {
        const [existingRows] = await pool.execute('SELECT id FROM panel_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const updateSql = `
            UPDATE panel_tasks 
            SET image_data = NULL, 
                image_mimetype = NULL, 
                image_date = NULL,
                image_uploaded_by = NULL,
                image_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error deleting image:', err);
        return res.status(500).json({ error: 'Failed to delete image' });
    }
});

// =========================================================
// MEDIA endpoint – upload both signature1 and image
// =========================================================
router.post('/:id/media', auth, upload.fields([
    { name: 'signature', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]), async (req, res) => {
    console.log(`POST /api/panel-tasks/${req.params.id}/media called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;
    const files = req.files;

    if (!files || (!files.signature && !files.image)) {
        return res.status(400).json({ error: 'At least one file (signature or image) must be uploaded' });
    }

    try {
        if (files.signature) {
            const [taskRows] = await pool.execute(
                'SELECT signature2_uploaded_by FROM panel_tasks WHERE id = ?',
                [taskId]
            );
            if (taskRows.length && taskRows[0].signature2_uploaded_by === userId) {
                return res.status(403).json({
                    error: 'You already uploaded Signature 2. Only one signature per user is allowed.'
                });
            }
        }

        const setClauses = [];
        const values = [];

        if (files.signature) {
            const sigFile = files.signature[0];
            setClauses.push('signature_data = ?, signature_mimetype = ?, signature_date = NOW(), signature_uploaded_by = ?, signature_uploaded_at = NOW()');
            values.push(sigFile.buffer, sigFile.mimetype, userId);
        }

        if (files.image) {
            const imgFile = files.image[0];
            setClauses.push('image_data = ?, image_mimetype = ?, image_date = NOW(), image_uploaded_by = ?, image_uploaded_at = NOW()');
            values.push(imgFile.buffer, imgFile.mimetype, userId);
        }

        const updateSql = `UPDATE panel_tasks SET ${setClauses.join(', ')} WHERE id = ?`;
        values.push(taskId);
        await pool.execute(updateSql, values);

        const selectSql = `
            SELECT pt.*, 
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM panel_tasks pt
            LEFT JOIN users su ON pt.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON pt.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON pt.image_uploaded_by = iu.id
            WHERE pt.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error uploading media:', err);
        return res.status(500).json({ error: 'Failed to upload media' });
    }
});

// =========================================================
// NEW: Get all files linked to a panel task
// =========================================================
router.get('/:id/files', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    try {
        const [rows] = await pool.execute(
            `SELECT id, file_name AS fileName, file_size AS fileSize, created_at AS uploadedAt
             FROM project_files
             WHERE taskNo = ?
             ORDER BY created_at DESC`,
            [taskId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching task files:', err);
        return res.status(500).json({ error: 'Failed to fetch task files' });
    }
});

// =========================================================
// Direct transportation creation from panel task (manual route)
// =========================================================
router.post('/:id/transportation', auth, async (req, res) => {
    console.log(`POST /api/panel-tasks/${req.params.id}/transportation called`);
    const panelTaskId = parseInt(req.params.id);

    try {
        const [panelRows] = await pool.execute(
            'SELECT title, description, project_no, due_date FROM panel_tasks WHERE id = ?',
            [panelTaskId]
        );
        if (panelRows.length === 0) {
            return res.status(404).json({ error: 'Panel task not found' });
        }
        const panel = panelRows[0];

        const insertSql = `
            INSERT INTO transportation_tasks 
            (title, description, priority, status, project_no, approve_status, due_date, panel_task_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const status = 'pending';
        const values = [
            panel.title,
            panel.description,
            'empty',
            status,
            panel.project_no,
            'Approved',
            panel.due_date,
            panelTaskId
        ];
        const [insertResult] = await pool.execute(insertSql, values);
        const transportId = insertResult.insertId;

        await updateProjectCounts(panel.project_no, 'transportation', 'total', 1);

        const [transportRows] = await pool.execute(
            'SELECT * FROM transportation_tasks WHERE id = ?',
            [transportId]
        );

        res.status(201).json({
            message: 'Transportation task created directly from panel task',
            transportationTask: transportRows[0]
        });
    } catch (err) {
        console.error('Error creating transportation task from panel:', err);
        return res.status(500).json({ error: 'Failed to create transportation task' });
    }
});

// =========================================================
// DELETE /api/panel-tasks/:id – Delete task and all related data
// =========================================================
router.delete('/:id', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    let taskToDelete;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            'SELECT project_no, status FROM panel_tasks WHERE id = ?',
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
            console.log(`🗑️ Deleted ${fileRows.length} file(s) linked to panel task ${taskId}`);
        }

        // Delete production records
        const [prodDeleteResult] = await connection.execute(
            `DELETE pr FROM production_records pr
             JOIN panels p ON pr.panel_id = p.id
             WHERE p.job_no = ?`,
            [taskToDelete.project_no]
        );
        console.log(`🗑️ Deleted ${prodDeleteResult.affectedRows} production record(s) for project ${taskToDelete.project_no}`);

        // Delete panels
        const [panelDeleteResult] = await connection.execute(
            'DELETE FROM panels WHERE job_no = ?',
            [taskToDelete.project_no]
        );
        console.log(`🗑️ Deleted ${panelDeleteResult.affectedRows} panel(s) for project ${taskToDelete.project_no}`);

        // Delete the panel task
        const [deleteResult] = await connection.execute(
            'DELETE FROM panel_tasks WHERE id = ?',
            [taskId]
        );
        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Task not found' });
        }

        // Update project counts
        await updateProjectCounts(taskToDelete.project_no, TASK_TYPE_PREFIX, 'total', -1);
        if (taskToDelete.status.toLowerCase() === 'cutting') {
            await updateProjectCounts(taskToDelete.project_no, TASK_TYPE_PREFIX, 'completed', -1);
        }

        await connection.commit();

        res.status(200).json({
            message: 'Panel task, linked files, panels, and production records deleted successfully',
            taskId,
            project_no: taskToDelete.project_no,
            filesDeleted: fileRows.length,
            panelsDeleted: panelDeleteResult.affectedRows,
            productionRecordsDeleted: prodDeleteResult.affectedRows
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error(`Error deleting panel task:`, err);
        return res.status(500).json({ error: 'Failed to delete task, files, panels, and production records' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;