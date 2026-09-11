const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { updateProjectCounts } = require('./projectUpdater');
const multer = require('multer');
const auth = require('../middleware/auth');

const TASK_TYPE_PREFIX = 'transportation';

// ---------- Multer config for images/signatures ----------
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

// ---------- Multer for generic file uploads (attachments) ----------
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

// ---------- Utility: formatTask with both signatures ----------
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

// =========================================================
// GET /api/transportation-tasks - All approved tasks (with both signature uploaders)
// =========================================================
router.get('/', auth, async (req, res) => {
    const query = `
        SELECT tt.*,
               su.username AS signature_uploader_username,
               su2.username AS signature2_uploader_username,
               iu.username AS image_uploader_username
        FROM transportation_tasks tt
        LEFT JOIN users su ON tt.signature_uploaded_by = su.id
        LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
        LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
        WHERE tt.approve_status = 'Approved'
        ORDER BY tt.created_at DESC
    `;
    try {
        const [results] = await pool.execute(query);
        res.json(results.map(formatTask));
    } catch (err) {
        console.error('Error fetching approved transportation tasks:', err);
        return res.status(500).json({ error: 'Failed to fetch approved transportation tasks' });
    }
});

// =========================================================
// POST /api/transportation-tasks - Create (with remark)
// =========================================================
router.post('/', auth, async (req, res) => {
    const { title, description, remark, priority, status, project_no, due_date } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }
    if (!project_no || !project_no.trim()) {
        return res.status(400).json({ error: 'Project No is required' });
    }

    const sanitizedDescription = description === undefined || description === '' ? null : description;
    const sanitizedRemark = remark === undefined || remark === '' ? null : remark;
    const sanitizedDueDate = due_date === undefined || due_date === '' ? null : due_date;
    const initialStatus = status || 'pending';

    // Resolve project_id from project_no
    let resolvedProjectId = null;
    const [projectRows] = await pool.execute(
        'SELECT id FROM projects WHERE projectNo = ?',
        [project_no]
    );
    if (projectRows.length > 0) {
        resolvedProjectId = projectRows[0].id;
    }

    if (!resolvedProjectId) {
        return res.status(400).json({
            error: `Could not resolve project_id for project_no '${project_no}'.`
        });
    }

    const insertSql = `INSERT INTO transportation_tasks 
                       (title, description, remark, priority, status, project_no, project_id, due_date, created_at) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    try {
        const [insertResults] = await pool.execute(insertSql, [
            title,
            sanitizedDescription,
            sanitizedRemark,
            priority,
            initialStatus,
            project_no,
            resolvedProjectId,
            sanitizedDueDate
        ]);
        const insertId = insertResults.insertId;

        await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'total', 1);
        if (initialStatus.toLowerCase() === 'completed') {
            await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'completed', 1);
        }

        // Fetch with uploader info
        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [insertId]
        );
        if (rows.length === 0) {
            return res.status(500).json({ error: 'Task created but failed to fetch.' });
        }

        res.status(201).json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error creating transportation task:', err);
        return res.status(500).json({ error: 'Failed to create transportation task' });
    }
});

// =========================================================
// PATCH /api/transportation-tasks/:id (with auto-clear on on-hold)
// =========================================================
router.patch('/:id', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    const updates = req.body;
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Request body must contain fields to update.' });
    }

    let previousTask;
    try {
        const [existingRows] = await pool.execute('SELECT project_no, status FROM transportation_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        previousTask = existingRows[0];
    } catch (err) {
        console.error('Error fetching existing task:', err);
        return res.status(500).json({ error: 'Database error before update' });
    }

    // Build dynamic SET clause for text fields - description and remark are NOT allowed to be updated
    const allowedFields = ['title', 'priority', 'status', 'project_no', 'due_date'];
    const fieldsToUpdate = [];
    const updateValues = [];
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            fieldsToUpdate.push(`${field} = ?`);
            const value = (updates[field] === '' && field === 'due_date') ? null : updates[field];
            updateValues.push(value);
        }
    }

    // ------ Determine new status and auto-clear if on-hold ------
    const newStatus = updates.status ? updates.status.toLowerCase() : previousTask.status.toLowerCase();

    if (newStatus === 'on-hold') {
        // Force clear all media – this will happen regardless of frontend flags
        fieldsToUpdate.push('image_data = NULL, image_mimetype = NULL, image_date = NULL, image_uploaded_by = NULL, image_uploaded_at = NULL');
        fieldsToUpdate.push('signature_data = NULL, signature_mimetype = NULL, signature_date = NULL, signature_uploaded_by = NULL, signature_uploaded_at = NULL');
        fieldsToUpdate.push('signature2_data = NULL, signature2_mimetype = NULL, signature2_date = NULL, signature2_uploaded_by = NULL, signature2_uploaded_at = NULL');
    } else {
        // Also respect explicit clear flags if sent
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
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const setClause = fieldsToUpdate.join(', ');
    const updateSql = `UPDATE transportation_tasks SET ${setClause} WHERE id = ?`;
    const finalBindValues = [...updateValues, taskId];

    try {
        await pool.execute(updateSql, finalBindValues);

        const oldStatus = previousTask.status.toLowerCase();

        if (newStatus === 'completed' && oldStatus !== 'completed') {
            await updateProjectCounts(previousTask.project_no, TASK_TYPE_PREFIX, 'completed', 1);
        } else if (newStatus !== 'completed' && oldStatus === 'completed') {
            await updateProjectCounts(previousTask.project_no, TASK_TYPE_PREFIX, 'completed', -1);
        }

        // Fetch and return updated task with uploader info
        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error updating transportation task:', err);
        return res.status(500).json({ error: 'Failed to update transportation task' });
    }
});

// =========================================================
// SIGNATURE 1 endpoints (with cross-user check)
// =========================================================
router.post('/:id/signature1', auth, upload.single('signature'), async (req, res) => {
    console.log(`POST /api/transportation-tasks/${req.params.id}/signature1 called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No signature file uploaded' });
    }

    try {
        const [taskRows] = await pool.execute(
            'SELECT signature2_uploaded_by FROM transportation_tasks WHERE id = ?',
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
            UPDATE transportation_tasks 
            SET signature_data = ?, 
                signature_mimetype = ?, 
                signature_date = NOW(),
                signature_uploaded_by = ?,
                signature_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [signatureData, signatureMimetype, userId, taskId]);

        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error uploading signature 1:', err);
        return res.status(500).json({ error: 'Failed to upload signature 1' });
    }
});

router.delete('/:id/signature1', auth, async (req, res) => {
    console.log(`DELETE /api/transportation-tasks/${req.params.id}/signature1 called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM transportation_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE transportation_tasks 
            SET signature_data = NULL, 
                signature_mimetype = NULL, 
                signature_date = NULL,
                signature_uploaded_by = NULL,
                signature_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error deleting signature 1:', err);
        return res.status(500).json({ error: 'Failed to delete signature 1' });
    }
});

// =========================================================
// SIGNATURE 2 endpoints (with cross-user check)
// =========================================================
router.post('/:id/signature2', auth, upload.single('signature'), async (req, res) => {
    console.log(`POST /api/transportation-tasks/${req.params.id}/signature2 called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No signature file uploaded' });
    }

    try {
        const [taskRows] = await pool.execute(
            'SELECT signature_uploaded_by FROM transportation_tasks WHERE id = ?',
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
            UPDATE transportation_tasks 
            SET signature2_data = ?, 
                signature2_mimetype = ?, 
                signature2_date = NOW(),
                signature2_uploaded_by = ?,
                signature2_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [signatureData, signatureMimetype, userId, taskId]);

        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error uploading signature 2:', err);
        return res.status(500).json({ error: 'Failed to upload signature 2' });
    }
});

router.delete('/:id/signature2', auth, async (req, res) => {
    console.log(`DELETE /api/transportation-tasks/${req.params.id}/signature2 called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM transportation_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE transportation_tasks 
            SET signature2_data = NULL, 
                signature2_mimetype = NULL, 
                signature2_date = NULL,
                signature2_uploaded_by = NULL,
                signature2_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error deleting signature 2:', err);
        return res.status(500).json({ error: 'Failed to delete signature 2' });
    }
});

// =========================================================
// IMAGE endpoints (separate)
// =========================================================
router.post('/:id/image', auth, upload.single('image'), async (req, res) => {
    console.log(`POST /api/transportation-tasks/${req.params.id}/image called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
    }

    try {
        const updateSql = `
            UPDATE transportation_tasks 
            SET image_data = ?, 
                image_mimetype = ?, 
                image_date = NOW(),
                image_uploaded_by = ?,
                image_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [req.file.buffer, req.file.mimetype, userId, taskId]);

        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error uploading image:', err);
        return res.status(500).json({ error: 'Failed to upload image' });
    }
});

router.delete('/:id/image', auth, async (req, res) => {
    console.log(`DELETE /api/transportation-tasks/${req.params.id}/image called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM transportation_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE transportation_tasks 
            SET image_data = NULL, 
                image_mimetype = NULL, 
                image_date = NULL,
                image_uploaded_by = NULL,
                image_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error deleting image:', err);
        return res.status(500).json({ error: 'Failed to delete image' });
    }
});

// =========================================================
// POST /api/transportation-tasks/:id/media (legacy) – upload signature1 + image
// =========================================================
router.post('/:id/media', auth, upload.fields([
    { name: 'signature', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]), async (req, res) => {
    console.log(`POST /api/transportation-tasks/${req.params.id}/media called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;
    const files = req.files;
    if (!files || (!files.signature && !files.image)) {
        return res.status(400).json({ error: 'At least one file (signature or image) must be uploaded' });
    }

    try {
        // Check if uploading signature1 and signature2 already has same user
        if (files.signature) {
            const [taskRows] = await pool.execute(
                'SELECT signature2_uploaded_by FROM transportation_tasks WHERE id = ?',
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
        const updateSql = `UPDATE transportation_tasks SET ${setClauses.join(', ')} WHERE id = ?`;
        values.push(taskId);
        await pool.execute(updateSql, values);

        const [rows] = await pool.execute(
            `SELECT tt.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM transportation_tasks tt
             LEFT JOIN users su ON tt.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON tt.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON tt.image_uploaded_by = iu.id
             WHERE tt.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error uploading media:', err);
        return res.status(500).json({ error: 'Failed to upload media' });
    }
});

// =========================================================
// FILE ATTACHMENT ENDPOINTS
// =========================================================

// GET /api/transportation-tasks/:id/files – list attached files
router.get('/:id/files', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);

    try {
        const [existing] = await pool.execute(
            'SELECT id FROM transportation_tasks WHERE id = ?',
            [taskId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Transportation task not found' });
        }

        const [files] = await pool.execute(
            `SELECT id, 
                    file_name AS fileName, 
                    file_size AS fileSize, 
                    mime_type AS fileType,
                    category AS taskType,
                    taskNo,
                    created_at AS uploadedAt,
                    project_id
             FROM project_files
             WHERE category = 'transportation' AND taskNo = ?
             ORDER BY created_at DESC`,
            [taskId]
        );

        // No uploader info, set to null
        const filesWithUploader = files.map(file => ({
            ...file,
            uploadedBy: null
        }));

        res.json(filesWithUploader);
    } catch (err) {
        console.error('Error fetching transportation task files:', err);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// POST /api/transportation-tasks/:id/files – upload a file
router.post('/:id/files', auth, fileUpload.single('file'), async (req, res) => {
    const taskId = parseInt(req.params.id);

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const [taskExists] = await pool.execute(
            'SELECT id, project_id FROM transportation_tasks WHERE id = ?',
            [taskId]
        );
        if (taskExists.length === 0) {
            return res.status(404).json({ error: 'Transportation task not found' });
        }
        const projectId = taskExists[0].project_id;

        const insertSql = `
            INSERT INTO project_files
            (file_name, file_data, file_size, mime_type, category, taskNo, project_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await pool.execute(insertSql, [
            req.file.originalname,
            req.file.buffer,
            req.file.size,
            req.file.mimetype,
            'transportation',
            taskId,
            projectId || null
        ]);

        res.status(201).json({
            message: 'File uploaded successfully',
            fileId: result.insertId,
            fileName: req.file.originalname,
        });
    } catch (err) {
        console.error('Error uploading file to transportation task:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// DELETE /api/transportation-tasks/:id/files/:fileId – delete a file
router.delete('/:id/files/:fileId', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    const fileId = parseInt(req.params.fileId);

    try {
        const [fileRows] = await pool.execute(
            'SELECT id FROM project_files WHERE id = ? AND category = ? AND taskNo = ?',
            [fileId, 'transportation', taskId]
        );
        if (fileRows.length === 0) {
            return res.status(404).json({ error: 'File not found for this task' });
        }

        await pool.execute(
            'DELETE FROM project_files WHERE id = ?',
            [fileId]
        );

        res.json({ message: 'File deleted successfully' });
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// =========================================================
// DELETE /api/transportation-tasks/:id (updated to delete files)
// =========================================================
router.delete('/:id', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    let taskToDelete;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            'SELECT project_id, project_no, status FROM transportation_tasks WHERE id = ?',
            [taskId]
        );
        if (existingRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Task not found' });
        }
        taskToDelete = existingRows[0];

        // Delete linked files
        const [fileRows] = await connection.execute(
            'SELECT id FROM project_files WHERE category = ? AND taskNo = ?',
            ['transportation', taskId]
        );
        if (fileRows.length > 0) {
            const fileIds = fileRows.map(f => f.id);
            const placeholders = fileIds.map(() => '?').join(',');
            await connection.execute(
                `DELETE FROM project_files WHERE id IN (${placeholders})`,
                fileIds
            );
            console.log(`🗑️ Deleted ${fileRows.length} file(s) linked to transportation task ${taskId}`);
        }

        const [deleteResult] = await connection.execute(
            'DELETE FROM transportation_tasks WHERE id = ?',
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
            message: 'Transportation task and linked files deleted successfully',
            taskId,
            project_no: taskToDelete.project_no,
            filesDeleted: fileRows.length
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error deleting transportation task with files:', err);
        return res.status(500).json({ error: 'Failed to delete task and its files' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;