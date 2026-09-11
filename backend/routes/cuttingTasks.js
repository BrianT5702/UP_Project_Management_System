const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { updateProjectCounts } = require('./projectUpdater');
const multer = require('multer');
const auth = require('../middleware/auth');

const TASK_TYPE_PREFIX = 'cutting';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype) return cb(null, true);
        else cb(new Error('Only image files are allowed!'));
    }
});

// Generic file upload (no image filter) for attachments
const fileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});

// ---------- Utility: formatTask with both signatures ----------
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
// Helper: Create or update transportation task (with project_id)
// =========================================================
const createOrUpdateTransportationTask = async (cuttingTask) => {
    try {
        const [projectRows] = await pool.execute(
            'SELECT id FROM projects WHERE projectNo = ?',
            [cuttingTask.project_no]
        );
        if (projectRows.length === 0) {
            console.error(`Project not found for project_no: ${cuttingTask.project_no}`);
            return;
        }
        const projectId = projectRows[0].id;

        const [existing] = await pool.execute(
            'SELECT id, project_id FROM transportation_tasks WHERE cutting_task_id = ?',
            [cuttingTask.id]
        );

        if (existing.length > 0) {
            const needsProjectIdBackfill = !existing[0].project_id && cuttingTask.project_id;
            const updateSql = `
                UPDATE transportation_tasks 
                SET status = 'pending', 
                    title = ?, 
                    description = ?, 
                    priority = ?, 
                    project_no = ?, 
                    project_id = ${needsProjectIdBackfill ? '?' : 'project_id'},
                    due_date = ?
                WHERE cutting_task_id = ?
            `;
            const values = [
                cuttingTask.title,
                cuttingTask.description || null,
                cuttingTask.priority || 'empty',
                cuttingTask.project_no,
            ];
            if (needsProjectIdBackfill) {
                values.push(cuttingTask.project_id);
            }
            values.push(cuttingTask.due_date || null, cuttingTask.id);
            await pool.execute(updateSql, values);
            console.log(`✅ Updated existing transportation task for cutting task ${cuttingTask.id} to 'pending'`);
        } else {
            const insertSql = `
                INSERT INTO transportation_tasks 
                (title, description, priority, status, project_no, project_id, approve_status, due_date, cutting_task_id, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            const values = [
                cuttingTask.title,
                cuttingTask.description || null,
                cuttingTask.priority || 'empty',
                'pending',
                cuttingTask.project_no,
                projectId,
                'Approved',
                cuttingTask.due_date || null,
                cuttingTask.id
            ];
            await pool.execute(insertSql, values);
            console.log(`✅ Created new transportation task for cutting task ${cuttingTask.id} (project_id: ${projectId})`);
        }
    } catch (err) {
        console.error('Failed to create or update transportation task:', err);
    }
};

const updateTransportationTaskStatus = async (cuttingTaskId, newStatus) => {
    try {
        const updateSql = `
            UPDATE transportation_tasks 
            SET status = ? 
            WHERE cutting_task_id = ?
        `;
        const [result] = await pool.execute(updateSql, [newStatus, cuttingTaskId]);
        if (result.affectedRows > 0) {
            console.log(`✅ Transportation task status updated to '${newStatus}' for cutting task ${cuttingTaskId}`);
        } else {
            console.log(`ℹ️ No transportation task found for cutting task ${cuttingTaskId}`);
        }
    } catch (err) {
        console.error('Failed to update transportation task status:', err);
    }
};

// =========================================================
// GET /api/cutting-tasks
// =========================================================
router.get('/', auth, async (req, res) => {
    const query = `
        SELECT ct.*,
               su.username AS signature_uploader_username,
               su2.username AS signature2_uploader_username,
               iu.username AS image_uploader_username
        FROM cutting_tasks ct
        LEFT JOIN users su ON ct.signature_uploaded_by = su.id
        LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
        LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
        WHERE ct.approve_status = 'Approved'
        ORDER BY ct.created_at DESC
    `;
    try {
        const [results] = await pool.execute(query);
        res.json(results.map(formatTask));
    } catch (err) {
        console.error('Error fetching approved cutting tasks:', err);
        return res.status(500).json({ error: 'Failed to fetch approved cutting tasks' });
    }
});

// =========================================================
// POST /api/cutting-tasks (create or update from panel)
// =========================================================
router.post('/', auth, async (req, res) => {
    const {
        title,
        description,
        priority,
        status,
        project_no,
        due_date,
        approve_status,
        panel_task_id
    } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }
    if (!project_no || !project_no.trim()) {
        return res.status(400).json({ error: 'Project No is required' });
    }

    const sanitizedPanelTaskId = panel_task_id ? parseInt(panel_task_id) : null;
    const initialStatus = status || 'pending';

    // Resolve project_id
    let resolvedProjectId = null;
    if (sanitizedPanelTaskId) {
        const [panelRows] = await pool.execute(
            'SELECT project_id FROM panel_tasks WHERE id = ?',
            [sanitizedPanelTaskId]
        );
        if (panelRows.length > 0) {
            resolvedProjectId = panelRows[0].project_id;
        }
    }
    if (!resolvedProjectId) {
        const [projectRows] = await pool.execute(
            'SELECT id FROM projects WHERE projectNo = ?',
            [project_no]
        );
        if (projectRows.length > 0) {
            resolvedProjectId = projectRows[0].id;
        }
    }
    if (!resolvedProjectId) {
        return res.status(400).json({
            error: `Could not resolve project_id for project_no '${project_no}'.`
        });
    }

    // Check if a cutting task already exists for this panel_task_id
    let existingTask = null;
    if (sanitizedPanelTaskId) {
        const [rows] = await pool.execute(
            'SELECT * FROM cutting_tasks WHERE panel_task_id = ?',
            [sanitizedPanelTaskId]
        );
        if (rows.length > 0) {
            existingTask = rows[0];
        }
    }

    if (existingTask) {
        // ---- UPDATE existing task ----
        const oldStatus = existingTask.status.toLowerCase();
        const newStatus = initialStatus.toLowerCase();

        const allowedFields = ['title', 'description', 'priority', 'status', 'project_no', 'due_date', 'approve_status'];
        const fieldsToUpdate = [];
        const updateValues = [];
        for (const field of allowedFields) {
            let value = req.body[field];
            if (value !== undefined) {
                if ((field === 'description' || field === 'due_date') && value === '') value = null;
                fieldsToUpdate.push(`${field} = ?`);
                updateValues.push(value);
            }
        }
        if (!existingTask.project_id) {
            fieldsToUpdate.push('project_id = ?');
            updateValues.push(resolvedProjectId);
        }
        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ error: 'No fields to update.' });
        }

        const setClause = fieldsToUpdate.join(', ');
        const updateSql = `UPDATE cutting_tasks SET ${setClause} WHERE id = ?`;
        const finalBindValues = [...updateValues, existingTask.id];

        try {
            await pool.execute(updateSql, finalBindValues);

            if (newStatus === 'completed' && oldStatus !== 'completed') {
                await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'completed', 1);
            } else if (newStatus !== 'completed' && oldStatus === 'completed') {
                await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'completed', -1);
            }

            if (oldStatus !== 'completed' && newStatus === 'completed') {
                const [updatedTask] = await pool.execute('SELECT * FROM cutting_tasks WHERE id = ?', [existingTask.id]);
                if (updatedTask.length > 0) {
                    await createOrUpdateTransportationTask(updatedTask[0]);
                }
            } else if (newStatus === 'on-hold' || (oldStatus === 'completed' && newStatus !== 'completed')) {
                await updateTransportationTaskStatus(existingTask.id, 'on-hold');
            }

            const [rows] = await pool.execute(
                `SELECT ct.*,
                        su.username AS signature_uploader_username,
                        su2.username AS signature2_uploader_username,
                        iu.username AS image_uploader_username
                 FROM cutting_tasks ct
                 LEFT JOIN users su ON ct.signature_uploaded_by = su.id
                 LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
                 LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
                 WHERE ct.id = ?`,
                [existingTask.id]
            );
            res.status(200).json(formatTask(rows[0]));
        } catch (err) {
            console.error('Error updating cutting task (via panel_task_id):', err);
            return res.status(500).json({ error: 'Failed to update cutting task' });
        }
    } else {
        // ---- CREATE new task ----
        const insertSql = `
            INSERT INTO cutting_tasks 
            (title, description, priority, status, project_no, project_id, due_date, approve_status, panel_task_id, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        try {
            const [insertResults] = await pool.execute(insertSql, [
                title,
                description ?? null,
                priority ?? null,
                initialStatus,
                project_no,
                resolvedProjectId,
                due_date ?? null,
                approve_status ?? 'Pending',
                sanitizedPanelTaskId
            ]);

            await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'total', 1);
            if (initialStatus.toLowerCase() === 'completed') {
                await updateProjectCounts(project_no, TASK_TYPE_PREFIX, 'completed', 1);
            }

            if (initialStatus.toLowerCase() === 'completed') {
                const [newTask] = await pool.execute('SELECT * FROM cutting_tasks WHERE id = ?', [insertResults.insertId]);
                if (newTask.length > 0) {
                    await createOrUpdateTransportationTask(newTask[0]);
                }
            }

            const [rows] = await pool.execute('SELECT * FROM cutting_tasks WHERE id = ?', [insertResults.insertId]);
            res.status(201).json(formatTask(rows[0]));
        } catch (err) {
            console.error('Error creating cutting task:', err);
            return res.status(500).json({ error: 'Failed to create cutting task' });
        }
    }
});

// =========================================================
// PATCH /api/cutting-tasks/:id - Update with clear flags for both signatures
// =========================================================
router.patch('/:id', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Request body required.' });
    }

    let previousTask;
    try {
        const [existingRows] = await pool.execute(
            'SELECT project_no, status FROM cutting_tasks WHERE id = ?',
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

    const oldStatus = previousTask.status.toLowerCase();
    const newStatus = updates.status ? updates.status.toLowerCase() : oldStatus;

    // Allowed text fields
    const allowedFields = ['title', 'description', 'priority', 'status', 'project_no', 'due_date'];
    const fieldsToUpdate = [];
    const updateValues = [];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            fieldsToUpdate.push(`${field} = ?`);
            const value = (updates[field] === '' && (field === 'description' || field === 'due_date')) ? null : updates[field];
            updateValues.push(value);
        }
    }

    // Clear flags for both signatures and image
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

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const setClause = fieldsToUpdate.join(', ');
    const updateSql = `UPDATE cutting_tasks SET ${setClause} WHERE id = ?`;
    const finalBindValues = [...updateValues, taskId];

    try {
        await pool.execute(updateSql, finalBindValues);

        // Project counts
        const oldProjectNo = previousTask.project_no;
        const newProjectNo = updates.project_no || oldProjectNo;
        if (oldProjectNo !== newProjectNo) {
            await updateProjectCounts(oldProjectNo, TASK_TYPE_PREFIX, 'total', -1);
            if (oldStatus === 'completed') {
                await updateProjectCounts(oldProjectNo, TASK_TYPE_PREFIX, 'completed', -1);
            }
            await updateProjectCounts(newProjectNo, TASK_TYPE_PREFIX, 'total', 1);
            if (newStatus === 'completed') {
                await updateProjectCounts(newProjectNo, TASK_TYPE_PREFIX, 'completed', 1);
            }
        } else {
            if (newStatus === 'completed' && oldStatus !== 'completed') {
                await updateProjectCounts(newProjectNo, TASK_TYPE_PREFIX, 'completed', 1);
            } else if (newStatus !== 'completed' && oldStatus === 'completed') {
                await updateProjectCounts(newProjectNo, TASK_TYPE_PREFIX, 'completed', -1);
            }
        }

        // Transportation task logic
        if (oldStatus !== 'completed' && newStatus === 'completed') {
            const [updatedTask] = await pool.execute('SELECT * FROM cutting_tasks WHERE id = ?', [taskId]);
            if (updatedTask.length > 0) {
                await createOrUpdateTransportationTask(updatedTask[0]);
            }
        } else if (newStatus === 'on-hold' || (oldStatus === 'completed' && newStatus !== 'completed')) {
            await updateTransportationTaskStatus(taskId, 'on-hold');
        }

        const [rows] = await pool.execute(
            `SELECT ct.*,
                    su.username AS signature_uploader_username,
                    su2.username AS signature2_uploader_username,
                    iu.username AS image_uploader_username
             FROM cutting_tasks ct
             LEFT JOIN users su ON ct.signature_uploaded_by = su.id
             LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
             LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
             WHERE ct.id = ?`,
            [taskId]
        );
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error updating cutting task:', err);
        return res.status(500).json({ error: 'Failed to update cutting task' });
    }
});

// =========================================================
// SIGNATURE 1 endpoints (with cross-user check)
// =========================================================
router.post('/:id/signature1', auth, upload.single('signature'), async (req, res) => {
    console.log(`POST /api/cutting-tasks/${req.params.id}/signature1 called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No signature file uploaded' });
    }

    try {
        const [taskRows] = await pool.execute(
            'SELECT signature2_uploaded_by FROM cutting_tasks WHERE id = ?',
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
            UPDATE cutting_tasks 
            SET signature_data = ?, 
                signature_mimetype = ?, 
                signature_date = NOW(),
                signature_uploaded_by = ?,
                signature_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [signatureData, signatureMimetype, userId, taskId]);

        const selectSql = `
            SELECT ct.*,
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM cutting_tasks ct
            LEFT JOIN users su ON ct.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
            WHERE ct.id = ?
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
    console.log(`DELETE /api/cutting-tasks/${req.params.id}/signature1 called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM cutting_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE cutting_tasks 
            SET signature_data = NULL, 
                signature_mimetype = NULL, 
                signature_date = NULL,
                signature_uploaded_by = NULL,
                signature_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const selectSql = `
            SELECT ct.*,
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM cutting_tasks ct
            LEFT JOIN users su ON ct.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
            WHERE ct.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
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
    console.log(`POST /api/cutting-tasks/${req.params.id}/signature2 called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No signature file uploaded' });
    }

    try {
        const [taskRows] = await pool.execute(
            'SELECT signature_uploaded_by FROM cutting_tasks WHERE id = ?',
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
            UPDATE cutting_tasks 
            SET signature2_data = ?, 
                signature2_mimetype = ?, 
                signature2_date = NOW(),
                signature2_uploaded_by = ?,
                signature2_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [signatureData, signatureMimetype, userId, taskId]);

        const selectSql = `
            SELECT ct.*,
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM cutting_tasks ct
            LEFT JOIN users su ON ct.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
            WHERE ct.id = ?
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
    console.log(`DELETE /api/cutting-tasks/${req.params.id}/signature2 called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM cutting_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE cutting_tasks 
            SET signature2_data = NULL, 
                signature2_mimetype = NULL, 
                signature2_date = NULL,
                signature2_uploaded_by = NULL,
                signature2_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const selectSql = `
            SELECT ct.*,
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM cutting_tasks ct
            LEFT JOIN users su ON ct.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
            WHERE ct.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error deleting signature 2:', err);
        return res.status(500).json({ error: 'Failed to delete signature 2' });
    }
});

// =========================================================
// POST /api/cutting-tasks/:id/image - Upload image (record uploader)
// =========================================================
router.post('/:id/image', auth, upload.single('image'), async (req, res) => {
    console.log(`POST /api/cutting-tasks/${req.params.id}/image called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
    }

    try {
        const updateSql = `
            UPDATE cutting_tasks 
            SET image_data = ?, 
                image_mimetype = ?, 
                image_date = NOW(),
                image_uploaded_by = ?,
                image_uploaded_at = NOW()
            WHERE id = ?
        `;
        await pool.execute(updateSql, [req.file.buffer, req.file.mimetype, userId, taskId]);

        const selectSql = `
            SELECT ct.*,
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM cutting_tasks ct
            LEFT JOIN users su ON ct.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
            WHERE ct.id = ?
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
    console.log(`DELETE /api/cutting-tasks/${req.params.id}/image called`);
    const taskId = parseInt(req.params.id);
    try {
        const [existingRows] = await pool.execute('SELECT id FROM cutting_tasks WHERE id = ?', [taskId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updateSql = `
            UPDATE cutting_tasks 
            SET image_data = NULL, 
                image_mimetype = NULL, 
                image_date = NULL,
                image_uploaded_by = NULL,
                image_uploaded_at = NULL
            WHERE id = ?
        `;
        await pool.execute(updateSql, [taskId]);

        const selectSql = `
            SELECT ct.*,
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM cutting_tasks ct
            LEFT JOIN users su ON ct.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
            WHERE ct.id = ?
        `;
        const [rows] = await pool.execute(selectSql, [taskId]);
        res.json(formatTask(rows[0]));
    } catch (err) {
        console.error('Error deleting image:', err);
        return res.status(500).json({ error: 'Failed to delete image' });
    }
});

// =========================================================
// POST /api/cutting-tasks/:id/media - Upload signature1 + image (legacy)
// =========================================================
router.post('/:id/media', auth, upload.fields([
    { name: 'signature', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]), async (req, res) => {
    console.log(`POST /api/cutting-tasks/${req.params.id}/media called`);
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;
    const files = req.files;

    if (!files || (!files.signature && !files.image)) {
        return res.status(400).json({ error: 'At least one file (signature or image) must be uploaded' });
    }

    try {
        if (files.signature) {
            const [taskRows] = await pool.execute(
                'SELECT signature2_uploaded_by FROM cutting_tasks WHERE id = ?',
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

        const updateSql = `UPDATE cutting_tasks SET ${setClauses.join(', ')} WHERE id = ?`;
        values.push(taskId);
        await pool.execute(updateSql, values);

        const selectSql = `
            SELECT ct.*,
                   su.username AS signature_uploader_username,
                   su2.username AS signature2_uploader_username,
                   iu.username AS image_uploader_username
            FROM cutting_tasks ct
            LEFT JOIN users su ON ct.signature_uploaded_by = su.id
            LEFT JOIN users su2 ON ct.signature2_uploaded_by = su2.id
            LEFT JOIN users iu ON ct.image_uploaded_by = iu.id
            WHERE ct.id = ?
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
// FILE ATTACHMENT ENDPOINTS (adapted to your schema)
// =========================================================

// GET /api/cutting-tasks/:id/files - Get panel files for the same project
router.get('/:id/files', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);

    try {
        // 1. Get the cutting task to retrieve its project_id
        const [taskRows] = await pool.execute(
            'SELECT project_id FROM cutting_tasks WHERE id = ?',
            [taskId]
        );
        if (taskRows.length === 0) {
            return res.status(404).json({ error: 'Cutting task not found' });
        }
        const projectId = taskRows[0].project_id;

        // 2. Fetch all files that belong to this project AND have category = 'panel'
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
             WHERE project_id = ? AND category = 'panel'
             ORDER BY created_at DESC`,
        [projectId]
        );

        // If you have an 'uploaded_by' column, you could join users here;
        // otherwise set uploadedBy to null as before.
        const filesWithUploader = files.map(file => ({
            ...file,
            uploadedBy: null  // or join if available
        }));

        res.json(filesWithUploader);
    } catch (err) {
        console.error('Error fetching panel files for cutting task:', err);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// POST /api/cutting-tasks/:id/files - Upload a file attachment
router.post('/:id/files', auth, fileUpload.single('file'), async (req, res) => {
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const [taskExists] = await pool.execute(
            'SELECT id, project_id FROM cutting_tasks WHERE id = ?',
            [taskId]
        );
        if (taskExists.length === 0) {
            return res.status(404).json({ error: 'Cutting task not found' });
        }
        const projectId = taskExists[0].project_id;

        // Insert using your column names
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
            'cutting',          // category
            taskId,             // taskNo
            projectId || null
        ]);

        res.status(201).json({
            message: 'File uploaded successfully',
            fileId: result.insertId,
            fileName: req.file.originalname,
        });
    } catch (err) {
        console.error('Error uploading file to cutting task:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// DELETE /api/cutting-tasks/:id/files/:fileId - Delete a specific file
router.delete('/:id/files/:fileId', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    const fileId = parseInt(req.params.fileId);

    try {
        // Verify the file belongs to this cutting task using category and taskNo
        const [fileRows] = await pool.execute(
            'SELECT id FROM project_files WHERE id = ? AND category = ? AND taskNo = ?',
            [fileId, 'cutting', taskId]
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
// DELETE /api/cutting-tasks/:id - Delete task + linked files
// =========================================================
router.delete('/:id', auth, async (req, res) => {
    const taskId = parseInt(req.params.id);
    let taskToDelete;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            'SELECT project_no, status FROM cutting_tasks WHERE id = ?',
            [taskId]
        );
        if (existingRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Task not found' });
        }
        taskToDelete = existingRows[0];

        // Delete linked files (using category = 'cutting' and taskNo = taskId)
        const [fileRows] = await connection.execute(
            'SELECT id FROM project_files WHERE category = ? AND taskNo = ?',
            ['cutting', taskId]
        );
        if (fileRows.length > 0) {
            const fileIds = fileRows.map(f => f.id);
            const placeholders = fileIds.map(() => '?').join(',');
            await connection.execute(
                `DELETE FROM project_files WHERE id IN (${placeholders})`,
                fileIds
            );
            console.log(`🗑️ Deleted ${fileRows.length} file(s) linked to cutting task ${taskId}`);
        }

        const [deleteResult] = await connection.execute(
            'DELETE FROM cutting_tasks WHERE id = ?',
            [taskId]
        );
        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Task not found' });
        }

        await updateProjectCounts(taskToDelete.project_no, TASK_TYPE_PREFIX, 'total', -1);
        if (taskToDelete.status.toLowerCase() === 'completed') {
            await updateProjectCounts(taskToDelete.project_no, TASK_TYPE_PREFIX, 'completed', -1);
        }

        await connection.commit();

        res.status(200).json({
            message: 'Cutting task and linked files deleted successfully',
            taskId,
            filesDeleted: fileRows.length
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error deleting cutting task with files:', err);
        return res.status(500).json({ error: 'Failed to delete task and its files' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;