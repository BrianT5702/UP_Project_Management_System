const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const multer = require('multer');

// =========================================================
// 📝 ACTIVITY LOGGING
// =========================================================

async function logActivity(activityType, resourceType, resourceId, message, details = {}) {
    const userId = 1; // replace with actual user ID
    try {
        const query = `
            INSERT INTO activity_logs 
            (timestamp, user_id, activity_type, resource_type, resource_id, message, details) 
            VALUES (NOW(), ?, ?, ?, ?, ?, ?)
        `;
        const detailsJson = JSON.stringify(details);
        await db.query(query, [userId, activityType, resourceType, resourceId, message, detailsJson]);
    } catch (err) {
        console.error('CRITICAL: Activity logging failed:', err);
    }
}

// =========================================================
// 🔄 CASCADE STATUS HELPERS
// =========================================================

async function updateTransportationForCategory(connection, projectId, category, status, taskIds) {
    const columnMap = {
        cutting: 'cutting_task_id',
        door: 'door_task_id',
        strip_curtain: 'strip_curtain_task_id',
        accessories: 'accessories_task_id',
        system: 'system_task_id',
        quotation: 'quotation_task_id',
        panel: 'panel_task_id'   // <-- ADDED for direct panel → transportation
    };
    const column = columnMap[category];
    if (!column) return { affected: 0 };

    let query, params;
    if (taskIds && taskIds.length > 0) {
        const placeholders = taskIds.map(() => '?').join(',');
        query = `UPDATE transportation_tasks SET status = ? WHERE ${column} IN (${placeholders})`;
        params = [status, ...taskIds];
    } else {
        const tableMap = {
            cutting: 'cutting_tasks',
            door: 'door_tasks',
            strip_curtain: 'strip_curtain_tasks',
            accessories: 'accessories_tasks',
            system: 'system_tasks',
            quotation: 'quotation_tasks',
            panel: 'panel_tasks'   // <-- also added for panel table
        };
        const table = tableMap[category];
        if (!table) return { affected: 0 };

        query = `
            UPDATE transportation_tasks t
            JOIN ${table} ct ON t.${column} = ct.id
            SET t.status = ?
            WHERE ct.project_id = ?
        `;
        params = [status, projectId];
    }
    const [result] = await connection.query(query, params);
    return { affected: result.affectedRows };
}

async function cascadeStatusToDependents(connection, projectId, triggeringCategory, status, taskIds) {
    const updates = {};

    if (triggeringCategory !== 'panel') {
        const transportResult = await updateTransportationForCategory(connection, projectId, triggeringCategory, status, taskIds);
        updates.transportation = transportResult.affected;
    }

    if (triggeringCategory === 'panel') {
        let targetStatus = status;
        let cuttingIds = [];

        if (taskIds && taskIds.length > 0) {
            const placeholders = taskIds.map(() => '?').join(',');
            const [rows] = await connection.query(
                `SELECT id FROM cutting_tasks WHERE panel_task_id IN (${placeholders}) AND project_id = ?`,
                [...taskIds, projectId]
            );
            cuttingIds = rows.map(r => r.id);
        } else {
            const [rows] = await connection.query(
                `SELECT id FROM cutting_tasks WHERE project_id = ?`,
                [projectId]
            );
            cuttingIds = rows.map(r => r.id);
        }

        if (cuttingIds.length > 0) {
            const placeholders = cuttingIds.map(() => '?').join(',');
            const [cuttingResult] = await connection.query(
                `UPDATE cutting_tasks SET status = ? WHERE id IN (${placeholders})`,
                [targetStatus, ...cuttingIds]
            );
            updates.cutting = cuttingResult.affectedRows;

            const transportCutting = await updateTransportationForCategory(connection, projectId, 'cutting', targetStatus, cuttingIds);
            updates.transportation_cutting = transportCutting.affected;
        } else {
            updates.cutting = 0;
            updates.transportation_cutting = 0;
        }

        // ★ NEW: Also update transportation tasks directly linked to these panel tasks
        const transportDirect = await updateTransportationForCategory(connection, projectId, 'panel', status, taskIds);
        updates.transportation_panel = transportDirect.affected;
    }

    return updates;
}

// =========================================================
// 📦 MULTER & UTILITY HELPERS
// =========================================================

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

async function deleteAllProjectFiles(projectId) {
    await db.query('DELETE FROM project_files WHERE project_id = ?', [projectId]);
    console.log(`Cleaned up all BLOB file records for project ID ${projectId}.`);
}

async function calculateCompletionPercentage(projectId) {
    try {
        const completion = {
            panelSlab: { completed: 0, total: 0, percentage: 0 },
            cutting: { completed: 0, total: 0, percentage: 0 },
            door: { completed: 0, total: 0, percentage: 0 },
            stripCurtain: { completed: 0, total: 0, percentage: 0 },
            accessories: { completed: 0, total: 0, percentage: 0 },
            system: { completed: 0, total: 0, percentage: 0 }
        };

        const taskTypes = [
            { table: 'panel_tasks', key: 'panelSlab', completedExpr: "LOWER(status) = 'cutting'" },
            { table: 'cutting_tasks', key: 'cutting', completedExpr: "LOWER(status) = 'completed'" },
            { table: 'door_tasks', key: 'door', completedExpr: "LOWER(status) = 'completed'" },
            { table: 'strip_curtain_tasks', key: 'stripCurtain', completedExpr: "LOWER(status) = 'completed'" },
            { table: 'accessories_tasks', key: 'accessories', completedExpr: "LOWER(status) = 'completed'" },
            { table: 'system_tasks', key: 'system', completedExpr: "LOWER(status) = 'completed'" }
        ];

        for (const taskType of taskTypes) {
            const [results] = await db.query(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN ${taskType.completedExpr} THEN 1 ELSE 0 END) as completed
                FROM ${taskType.table} 
                WHERE project_id = ?`,
                [projectId]
            );

            if (results[0]) {
                completion[taskType.key].total = results[0].total || 0;
                completion[taskType.key].completed = results[0].completed || 0;
                completion[taskType.key].percentage = results[0].total > 0
                    ? Math.round((results[0].completed / results[0].total) * 100)
                    : 0;
            }
        }

        return completion;
    } catch (error) {
        console.error('Error calculating completion:', error);
        throw error;
    }
}

function getEmptyCompletion() {
    return {
        panelSlab: { completed: 0, total: 0, percentage: 0 },
        cutting: { completed: 0, total: 0, percentage: 0 },
        door: { completed: 0, total: 0, percentage: 0 },
        stripCurtain: { completed: 0, total: 0, percentage: 0 },
        accessories: { completed: 0, total: 0, percentage: 0 },
        system: { completed: 0, total: 0, percentage: 0 }
    };
}

function invalidateProjectCache() {
    console.log('invalidateProjectCache called (no-op)');
}

function mapProductionStatus(status) {
    if (status === 'on-hold') return 'on_hold';
    return status;
}

async function updatePanelsStatusForProject(connection, projectId, status) {
    const [panelResult] = await connection.query(
        'UPDATE panels SET status = ? WHERE project_id = ?',
        [status, projectId]
    );
    console.log(`✅ Panels for project ID ${projectId} updated to '${status}' (${panelResult.affectedRows} panel(s))`);

    const prodStatus = mapProductionStatus(status);
    const [prodResult] = await connection.query(
        `UPDATE production_records pr
         JOIN panels pa ON pr.panel_id = pa.id
         SET pr.status = ?
         WHERE pa.project_id = ?`,
        [prodStatus, projectId]
    );
    console.log(`✅ Production records for project ID ${projectId} updated to '${prodStatus}' (${prodResult.affectedRows} record(s))`);

    return panelResult.affectedRows;
}

// =========================================================
// 🧹 ON‑HOLD CASCADE CLEANUP HELPERS
// =========================================================

const taskTableMap = {
    panel: 'panel_tasks',
    cutting: 'cutting_tasks',
    door: 'door_tasks',
    strip_curtain: 'strip_curtain_tasks',
    accessories: 'accessories_tasks',
    system: 'system_tasks',
    transportation: 'transportation_tasks',
    quotation: 'quotation_tasks'
};

const completedColumnMap = {
    cutting: 'completed_cutting',
    panel: 'completed_panel',
    door: 'completed_door',
    strip_curtain: 'completed_strip_curtain',
    accessories: 'completed_accessories',
    system: 'completed_system',
    transportation: 'completed_transportation',
    quotation: 'completed_quotation'
};

function isOnHold(status) {
    if (!status) return false;
    const normalized = String(status).toLowerCase().replace('_', '-');
    return normalized === 'on-hold';
}

function isCompletedStatus(category, status) {
    if (!status) return false;
    const normalized = String(status).toLowerCase();
    if (category === 'panel') {
        return normalized === 'cutting';
    }
    return normalized === 'completed';
}

/**
 * Clear all known signature/file columns for given task IDs in a table.
 */
async function clearSignatureAndImage(connection, table, taskIds) {
    if (!taskIds || taskIds.length === 0) return { affected: 0 };
    const placeholders = taskIds.map(() => '?').join(',');

    // Discover which columns exist
    const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
    const colNames = columns.map(c => c.Field);
    const setClauses = [];

    if (colNames.includes('signature')) setClauses.push('signature = NULL');
    if (colNames.includes('signature_data')) setClauses.push('signature_data = NULL');
    if (colNames.includes('signature_mimetype')) setClauses.push('signature_mimetype = NULL');
    if (colNames.includes('signature_date')) setClauses.push('signature_date = NULL');
    if (colNames.includes('file')) setClauses.push('file = NULL');
    if (colNames.includes('image_data')) setClauses.push('image_data = NULL');
    if (colNames.includes('image_mimetype')) setClauses.push('image_mimetype = NULL');
    if (colNames.includes('image_date')) setClauses.push('image_date = NULL');
    if (colNames.includes('image')) setClauses.push('image = NULL');

    if (setClauses.length === 0) {
        console.log(`ℹ️ No signature/file columns found in ${table}`);
        return { affected: 0 };
    }

    const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`;
    const [result] = await connection.query(query, taskIds);
    return { affected: result.affectedRows };
}

/**
 * Decrement completed count for a category (never below 0).
 */
async function decrementCompletedCount(connection, projectId, category, count) {
    const column = completedColumnMap[category];
    if (!column || !count || count <= 0) return { decremented: 0 };
    const [res] = await connection.query(
        `UPDATE projects SET ${column} = GREATEST(0, ${column} - ?) WHERE id = ?`,
        [count, projectId]
    );
    return { decremented: res.affectedRows > 0 ? count : 0 };
}

/**
 * Adjust completed count by a signed delta (+ to increment, - to decrement)
 */
async function adjustCompletedCount(connection, projectId, category, delta) {
    if (delta === 0) return { affected: 0 };
    const column = completedColumnMap[category];
    if (!column) return { affected: 0 };
    const sign = delta > 0 ? '+' : '-';
    const absDelta = Math.abs(delta);
    const query = `UPDATE projects SET ${column} = GREATEST(0, ${column} ${sign} ?) WHERE id = ?`;
    const [result] = await connection.query(query, [absDelta, projectId]);
    return { affected: result.affectedRows };
}

/**
 * Get the foreign key column name in transportation_tasks for a given category.
 */
function getTransportationForeignKey(category) {
    const map = {
        cutting: 'cutting_task_id',
        door: 'door_task_id',
        strip_curtain: 'strip_curtain_task_id',
        accessories: 'accessories_task_id',
        system: 'system_task_id',
        quotation: 'quotation_task_id',
        panel: 'panel_task_id'   // <-- ADDED
    };
    return map[category] || null;
}

/**
 * Fetch all transportation tasks linked to the given category and task IDs,
 * including the chain panel → cutting → transportation AND direct panel → transportation.
 * Returns an array of { id, status }.
 */
async function getLinkedTransportationTasks(connection, projectId, category, taskIds) {
    if (!taskIds || taskIds.length === 0) return [];

    // For panel, we must get both via cutting tasks AND direct links
    if (category === 'panel') {
        let transportRows = [];

        // 1) Via cutting tasks (existing logic)
        const placeholders = taskIds.map(() => '?').join(',');
        const [cuttingRows] = await connection.query(
            `SELECT id FROM cutting_tasks WHERE panel_task_id IN (${placeholders}) AND project_id = ?`,
            [...taskIds, projectId]
        );
        if (cuttingRows.length > 0) {
            const cuttingIds = cuttingRows.map(r => r.id);
            const cuttingPlaceholders = cuttingIds.map(() => '?').join(',');
            const [rows] = await connection.query(
                `SELECT id, status FROM transportation_tasks WHERE cutting_task_id IN (${cuttingPlaceholders}) AND project_id = ?`,
                [...cuttingIds, projectId]
            );
            transportRows = transportRows.concat(rows);
        }

        // 2) Direct panel → transportation
        const panelPlaceholders = taskIds.map(() => '?').join(',');
        const [directRows] = await connection.query(
            `SELECT id, status FROM transportation_tasks WHERE panel_task_id IN (${panelPlaceholders}) AND project_id = ?`,
            [...taskIds, projectId]
        );
        transportRows = transportRows.concat(directRows);

        // Remove duplicates (just in case a transport task is linked both ways)
        const unique = new Map();
        transportRows.forEach(row => unique.set(row.id, row));
        return Array.from(unique.values());
    }

    // For all other categories, use the direct foreign key
    const fkColumn = getTransportationForeignKey(category);
    if (!fkColumn) return [];

    const placeholders = taskIds.map(() => '?').join(',');
    const [transportRows] = await connection.query(
        `SELECT id, status FROM transportation_tasks WHERE ${fkColumn} IN (${placeholders}) AND project_id = ?`,
        [...taskIds, projectId]
    );
    return transportRows;
}

// =========================================================
// 📋 ROUTES
// =========================================================

// GET /
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM projects ORDER BY created_at DESC, id DESC');
        const projectsWithCompletion = await Promise.all(
            rows.map(async (project) => {
                try {
                    const completion = await calculateCompletionPercentage(project.id);
                    return { ...project, completion };
                } catch (err) {
                    console.error(`Error calculating completion for project ${project.projectNo}:`, err);
                    return { ...project, completion: getEmptyCompletion() };
                }
            })
        );
        res.json(projectsWithCompletion);
    } catch (err) {
        console.error('Database GET Error:', err);
        res.status(500).json({
            error: 'Failed to retrieve projects.',
            details: err.message
        });
    }
});

// GET /status/:status
router.get('/status/:status', async (req, res) => {
    const { status } = req.params;
    if (!['active', 'done', 'approved'].includes(status)) {
        return res.json([]);
    }
    try {
        const [rows] = await db.query(
            'SELECT * FROM projects WHERE status = ? ORDER BY created_at DESC, id DESC',
            [status]
        );
        const projectsWithCompletion = await Promise.all(
            rows.map(async (project) => {
                try {
                    const completion = await calculateCompletionPercentage(project.id);
                    return { ...project, completion };
                } catch (err) {
                    console.error(`Error calculating completion for project ${project.projectNo}:`, err);
                    return { ...project, completion: getEmptyCompletion() };
                }
            })
        );
        res.json(projectsWithCompletion);
    } catch (err) {
        console.error('Error fetching projects by status:', err);
        res.status(500).json({
            error: 'Failed to retrieve projects by status.',
            details: err.message
        });
    }
});

// GET /:projectNo/files
router.get('/:projectNo/files', async (req, res) => {
    const { projectNo } = req.params;
    const { category } = req.query;

    try {
        const [project] = await db.query('SELECT id FROM projects WHERE projectNo = ?', [projectNo]);
        if (project.length === 0) {
            return res.status(404).json({ success: false, error: 'Project not found.' });
        }
        const projectId = project[0].id;

        let query = `
            SELECT id, projectNo, file_name, file_size, mime_type, category, taskNo
            FROM project_files 
            WHERE project_id = ?
        `;
        const params = [projectId];

        if (category && category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }

        const [files] = await db.query(query, params);

        res.json({
            success: true,
            count: files.length,
            files: files
        });

    } catch (err) {
        console.error('Error fetching files:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve files from database.',
            details: err.message
        });
    }
});

// GET /files/:projectNo
router.get('/files/:projectNo', async (req, res) => {
    const { projectNo } = req.params;
    const { category } = req.query;

    try {
        const [project] = await db.query('SELECT id FROM projects WHERE projectNo = ?', [projectNo]);
        if (project.length === 0) {
            return res.status(404).json({ success: false, error: 'Project not found.' });
        }
        const projectId = project[0].id;

        let query = `
            SELECT id, projectNo, file_name, file_size, mime_type, category, taskNo
            FROM project_files 
            WHERE project_id = ?
        `;
        const params = [projectId];

        if (category && category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }

        const [files] = await db.query(query, params);

        res.json(files);

    } catch (err) {
        console.error('Error fetching files:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve files from database.',
            details: err.message
        });
    }
});

// PUT /file/:id/replace
router.put('/file/:id/replace', upload.single('file'), async (req, res) => {
    const fileId = req.params.id;
    const newFile = req.file;

    if (!newFile) {
        return res.status(400).json({ error: 'No new file provided.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existing] = await connection.query(
            'SELECT project_id, category, taskNo, file_name FROM project_files WHERE id = ?',
            [fileId]
        );
        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'File not found.' });
        }

        const { project_id, category, taskNo, file_name: oldName } = existing[0];
        const newFileName = newFile.originalname || oldName;

        await connection.query(
            `UPDATE project_files 
             SET file_data = ?, file_size = ?, mime_type = ?, file_name = ?
             WHERE id = ?`,
            [newFile.buffer, newFile.size, newFile.mimetype, newFileName, fileId]
        );

        if (taskNo && category) {
            const taskTable = taskTableMap[category];
            if (taskTable) {
                const newTitle = `${category.charAt(0).toUpperCase() + category.slice(1)} Task: ${newFileName}`;
                await connection.query(
                    `UPDATE ${taskTable} SET title = ? WHERE id = ?`,
                    [newTitle, taskNo]
                );
            }
        }

        await connection.commit();

        const [updated] = await connection.query(
            `SELECT id, projectNo, file_name, file_size, mime_type, category, taskNo
             FROM project_files WHERE id = ?`,
            [fileId]
        );

        invalidateProjectCache();
        res.json(updated[0]);

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error replacing file:', err);
        res.status(500).json({ error: 'Failed to replace file.', details: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// =========================================================
// ⏸️ TOGGLE ALL TASKS IN A CATEGORY
// =========================================================
router.patch('/tasks/category/:category/status', async (req, res) => {
    const { category } = req.params;
    const { projectNo, status } = req.query;

    if (!projectNo || !status) {
        return res.status(400).json({ error: 'projectNo and status are required.' });
    }

    const table = taskTableMap[category];
    if (!table) {
        return res.status(400).json({ error: 'Invalid category.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get project id
        const [project] = await connection.query('SELECT id FROM projects WHERE projectNo = ?', [projectNo]);
        if (project.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Project not found.' });
        }
        const projectId = project[0].id;

        // 1. Fetch all tasks in this category (their current statuses)
        const [taskRows] = await connection.query(
            `SELECT id, status FROM ${table} WHERE project_id = ?`,
            [projectId]
        );
        const taskIds = taskRows.map(r => r.id);

        // --- NEW: Pre-capture old statuses for cascaded tasks (cutting + transportation) ---
        let cuttingTasksOld = []; // only if category === 'panel'
        let transportTasksOld = [];

        // If we are setting to on-hold, we need old statuses before cascade updates them
        if (isOnHold(status)) {
            if (category === 'panel') {
                const placeholders = taskIds.map(() => '?').join(',');
                const [cuttingRows] = await connection.query(
                    `SELECT id, status FROM cutting_tasks WHERE panel_task_id IN (${placeholders}) AND project_id = ?`,
                    [...taskIds, projectId]
                );
                cuttingTasksOld = cuttingRows;
            }
            // Transport tasks linked to these main tasks (now also includes direct panel links)
            const linkedTransport = await getLinkedTransportationTasks(connection, projectId, category, taskIds);
            transportTasksOld = linkedTransport;
        }

        // 2. Update all tasks in this category
        const [updateResult] = await connection.query(
            `UPDATE ${table} SET status = ? WHERE project_id = ?`,
            [status, projectId]
        );

        // 3. Adjust completed count for main category
        const oldCompletedCount = taskRows.filter(r => isCompletedStatus(category, r.status)).length;
        const newCompletedCount = isCompletedStatus(category, status) ? taskRows.length : 0;
        const delta = newCompletedCount - oldCompletedCount;
        if (delta !== 0) {
            await adjustCompletedCount(connection, projectId, category, delta);
            console.log(`✅ Adjusted ${category} completed count by ${delta} (project ${projectId})`);
        }

        // 4. If new status is on-hold, clear signature/file on main tasks
        if (isOnHold(status)) {
            await clearSignatureAndImage(connection, table, taskIds);
        }

        // 5. Update panels & production
        const panelsUpdated = await updatePanelsStatusForProject(connection, projectId, status);

        // 6. Cascade status to dependents (cutting and transportation)
        const cascadeUpdates = await cascadeStatusToDependents(connection, projectId, category, status, taskIds);

        // 7. EXTRA: if on-hold, handle cleanup for cutting (if panel) and transportation using captured old statuses
        if (isOnHold(status)) {
            // --- Handle cutting cascade for panel (using pre-captured old statuses) ---
            if (category === 'panel') {
                const cuttingIds = cuttingTasksOld.map(r => r.id);
                if (cuttingIds.length > 0) {
                    // Decrement completed_cutting for cutting tasks that were completed
                    for (const cutting of cuttingTasksOld) {
                        if (isCompletedStatus('cutting', cutting.status)) {
                            await decrementCompletedCount(connection, projectId, 'cutting', 1);
                        }
                    }
                    // Clear signatures/images on cutting tasks
                    await clearSignatureAndImage(connection, 'cutting_tasks', cuttingIds);
                }
            }

            // --- Handle transportation cascade for ALL categories (using pre-captured old statuses) ---
            for (const transport of transportTasksOld) {
                if (isCompletedStatus('transportation', transport.status)) {
                    await decrementCompletedCount(connection, projectId, 'transportation', 1);
                }
                await clearSignatureAndImage(connection, 'transportation_tasks', [transport.id]);
            }
        }

        await connection.commit();
        invalidateProjectCache();

        await logActivity(
            'UPDATE',
            'TASK',
            projectId,
            `Set all ${category} tasks to '${status}' for project ${projectNo}. Panels: ${panelsUpdated} updated. Cascaded: ${JSON.stringify(cascadeUpdates)}.`,
            { category, status, affectedRows: updateResult.affectedRows, panelsUpdated, cascadeUpdates, delta }
        );

        res.json({
            message: `Updated ${updateResult.affectedRows} task(s) in ${category} to '${status}'. ${panelsUpdated} panel(s) updated.`,
            affectedRows: updateResult.affectedRows,
            panelsUpdated,
            cascadeUpdates
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error updating tasks status:', err);
        res.status(500).json({ error: 'Failed to update tasks status.', details: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// =========================================================
// ⏸️ TOGGLE SINGLE TASK STATUS
// =========================================================
router.patch('/tasks/:taskId/status', async (req, res) => {
    const { taskId } = req.params;
    const { category } = req.query;
    const { status } = req.body;

    if (!category || !status) {
        return res.status(400).json({ error: 'category and status are required.' });
    }

    const table = taskTableMap[category];
    if (!table) {
        return res.status(400).json({ error: 'Invalid category.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get current task info
        const [taskRows] = await connection.query(
            `SELECT project_id, project_no, status FROM ${table} WHERE id = ?`,
            [taskId]
        );
        if (taskRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Task not found.' });
        }
        const projectId = taskRows[0].project_id;
        const projectNo = taskRows[0].project_no;
        const oldStatus = taskRows[0].status;

        // --- NEW: Pre-capture old statuses for cascaded tasks (cutting + transportation) ---
        let cuttingTasksOld = []; // only if category === 'panel'
        let transportTasksOld = [];

        // If we are setting to on-hold, we need old statuses before cascade updates them
        if (isOnHold(status)) {
            if (category === 'panel') {
                const [cuttingRows] = await connection.query(
                    `SELECT id, status FROM cutting_tasks WHERE panel_task_id = ? AND project_id = ?`,
                    [taskId, projectId]
                );
                cuttingTasksOld = cuttingRows;
            }
            // Transport tasks linked to this main task (now includes direct panel links)
            const linkedTransport = await getLinkedTransportationTasks(connection, projectId, category, [parseInt(taskId)]);
            transportTasksOld = linkedTransport;
        }

        // 2. Update task status
        await connection.query(
            `UPDATE ${table} SET status = ? WHERE id = ?`,
            [status, taskId]
        );

        // 3. Adjust completed count for main category
        const oldCompleted = isCompletedStatus(category, oldStatus);
        const newCompleted = isCompletedStatus(category, status);
        const delta = newCompleted ? 1 : (oldCompleted ? -1 : 0);
        if (delta !== 0) {
            await adjustCompletedCount(connection, projectId, category, delta);
            console.log(`✅ Adjusted ${category} completed count by ${delta} (project ${projectId})`);
        }

        // 4. If new status is on-hold, clear signature/file on this task
        if (isOnHold(status)) {
            await clearSignatureAndImage(connection, table, [parseInt(taskId)]);
        }

        // 5. Update panels & production
        const panelsUpdated = await updatePanelsStatusForProject(connection, projectId, status);

        // 6. Cascade status to dependents
        const cascadeUpdates = await cascadeStatusToDependents(connection, projectId, category, status, [parseInt(taskId)]);

        // 7. EXTRA: if on-hold, handle cutting (if panel) and transportation using captured old statuses
        if (isOnHold(status)) {
            // --- Handle cutting cascade for panel ---
            if (category === 'panel') {
                const cuttingIds = cuttingTasksOld.map(r => r.id);
                if (cuttingIds.length > 0) {
                    for (const cutting of cuttingTasksOld) {
                        if (isCompletedStatus('cutting', cutting.status)) {
                            await decrementCompletedCount(connection, projectId, 'cutting', 1);
                        }
                    }
                    await clearSignatureAndImage(connection, 'cutting_tasks', cuttingIds);
                }
            }

            // --- Handle transportation cascade for ALL categories ---
            for (const transport of transportTasksOld) {
                if (isCompletedStatus('transportation', transport.status)) {
                    await decrementCompletedCount(connection, projectId, 'transportation', 1);
                }
                await clearSignatureAndImage(connection, 'transportation_tasks', [transport.id]);
            }
        }

        await connection.commit();
        invalidateProjectCache();

        await logActivity(
            'UPDATE',
            'TASK',
            taskId,
            `Task status updated to '${status}' (category: ${category}, project: ${projectNo}). Panels: ${panelsUpdated} updated. Cascaded: ${JSON.stringify(cascadeUpdates)}.`,
            { category, status, taskId, panelsUpdated, cascadeUpdates, delta }
        );

        res.json({
            success: true,
            taskId,
            status,
            panelsUpdated,
            cascadeUpdates,
            message: `Task updated. ${panelsUpdated} panel(s) set to '${status}'.`
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error updating task status:', err);
        res.status(500).json({ error: 'Failed to update task status.', details: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// =========================================================
// 📤 UPLOAD FILES
// =========================================================
router.post('/upload', upload.array('files'), async (req, res) => {
    const { projectNo, category } = req.body;
    const uploadedFiles = req.files;

    if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({ error: "No files selected for upload." });
    }

    const getCategoryDetails = (cat, customer, fileName) => {
        const baseDescription = `File '${fileName}' uploaded for projectNo ${projectNo}.`;
        const details = {
            'panel': { title: `Panel Task: ${fileName}`, description: baseDescription },
            'cutting': { title: `Cutting Task: ${fileName}`, description: baseDescription },
            'door': { title: `Door Task: ${fileName}`, description: baseDescription },
            'strip_curtain': { title: `Strip Curtain Task: ${fileName}`, description: baseDescription },
            'accessories': { title: `Accessories Task: ${fileName}`, description: baseDescription },
            'system': { title: `System Task: ${fileName}`, description: baseDescription },
            'transportation': { title: `Transport Task: ${fileName}`, description: baseDescription },
            'quotation': { title: `Quotation Task: ${fileName}`, description: baseDescription }
        };
        return details[cat] || {
            title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Task: ${fileName}`,
            description: baseDescription
        };
    };

    const categoryToColumn = {
        'cutting': 'total_cutting',
        'panel': 'total_panel',
        'door': 'total_door',
        'strip_curtain': 'total_strip_curtain',
        'accessories': 'total_accessories',
        'system': 'total_system',
        'transportation': 'total_transportation',
        'quotation': 'total_quotation'
    };

    let tasksCreatedCount = 0;
    let successfulUploadsCount = 0;
    let lastTaskId = null;
    let taskMessage = '';

    try {
        const [projectResult] = await db.query(
            'SELECT id, customer, status, requestedDelivery FROM projects WHERE projectNo = ?',
            [projectNo]
        );
        if (projectResult.length === 0) {
            return res.status(404).json({ error: `Project No. ${projectNo} not found.` });
        }

        const projectId = projectResult[0].id;
        const customer = projectResult[0].customer;
        const projectStatus = projectResult[0].status;
        const projectDueDate = projectResult[0].requestedDelivery;

        const taskTable = taskTableMap[category];
        const totalColumn = categoryToColumn[category];

        for (const file of uploadedFiles) {
            try {
                const fileData = file.buffer;
                if (!fileData || fileData.length === 0) {
                    console.error(`Skipping file: ${file.originalname} due to empty buffer.`);
                    continue;
                }

                const fileInsertQuery = `
                    INSERT INTO project_files 
                    (project_id, projectNo, file_name, file_size, mime_type, file_data, category) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                const [fileResult] = await db.query(fileInsertQuery, [
                    projectId,
                    projectNo,
                    file.originalname,
                    file.size,
                    file.mimetype,
                    fileData,
                    category || null
                ]);

                const projectFileId = fileResult.insertId;
                successfulUploadsCount++;

                let createdTaskId = null;

                if (category && taskTable) {
                    const details = getCategoryDetails(category, customer, file.originalname);
                    let approveStatus = 'Pending';
                    if (projectStatus === 'Approved') {
                        approveStatus = 'Approved';
                    }

                    const taskInsertQuery = `
                        INSERT INTO ${taskTable} 
                        (title, description, priority, status, project_id, project_no, due_date, created_at, approve_status) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
                    `;

                    const taskInsertValues = [
                        details.title,
                        details.description,
                        'empty',
                        'pending',
                        projectId,
                        projectNo,
                        projectDueDate,
                        approveStatus
                    ];

                    const [taskResult] = await db.query(taskInsertQuery, taskInsertValues);
                    createdTaskId = taskResult.insertId;
                    tasksCreatedCount++;
                    lastTaskId = createdTaskId;

                    await db.query(
                        `UPDATE project_files SET taskNo = ? WHERE id = ?`,
                        [createdTaskId, projectFileId]
                    );
                    console.log(`Linked Task ID ${createdTaskId} to File ID ${projectFileId}`);
                }

            } catch (fileError) {
                console.error(`Failed to process file ${file.originalname}:`, fileError);
            }
        }

        if (totalColumn && tasksCreatedCount > 0) {
            await db.query(
                `UPDATE projects SET ${totalColumn} = ${totalColumn} + ? WHERE id = ?`,
                [tasksCreatedCount, projectId]
            );
            console.log(`Incremented ${totalColumn} by ${tasksCreatedCount} for project ${projectNo}`);
            taskMessage = `Successfully created and linked ${tasksCreatedCount} tasks.`;
        }

        const fileNames = uploadedFiles.map(f => f.originalname).join(', ');

        const logMessage = category
            ? `${successfulUploadsCount} file(s) uploaded to ${category} category for project ${projectNo}: ${fileNames}. ${tasksCreatedCount} task(s) created.`
            : `${successfulUploadsCount} file(s) uploaded for project ${projectNo}: ${fileNames}`;

        const logDetails = {
            projectNo: projectNo,
            customer: customer,
            count: successfulUploadsCount,
            category: category || 'uncategorized',
            tasksCreated: tasksCreatedCount,
            lastTaskId: lastTaskId
        };

        await logActivity(
            'UPLOAD',
            'FILE',
            projectId,
            logMessage,
            logDetails
        );

        if (successfulUploadsCount === 0) {
            return res.status(500).json({ error: 'No files were successfully processed and uploaded to the database.' });
        }

        let responseMessage = `${successfulUploadsCount} file(s) uploaded successfully to ${category || 'database'} for project ${projectNo}.`;

        if (tasksCreatedCount > 0) {
            responseMessage += ` ${tasksCreatedCount} corresponding task(s) created and linked.`;
        }

        invalidateProjectCache();

        res.status(200).json({
            message: responseMessage,
            category: category,
            count: successfulUploadsCount,
            tasksCreated: tasksCreatedCount,
            taskMessage: taskMessage,
            lastTaskId: lastTaskId
        });

    } catch (err) {
        console.error('Critical upload process error:', err);
        res.status(500).json({
            error: 'Critical server error during upload process.',
            details: err.message
        });
    }
});

// =========================================================
// 🗑️ DELETE FILE (cascades for panel)
// =========================================================
router.delete('/file/:id', async (req, res) => {
    const fileId = req.params.id;

    const categoryToColumn = {
        'cutting': 'total_cutting',
        'panel': 'total_panel',
        'door': 'total_door',
        'strip_curtain': 'total_strip_curtain',
        'accessories': 'total_accessories',
        'system': 'total_system',
        'transportation': 'total_transportation',
        'quotation': 'total_quotation'
    };

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [fileInfo] = await connection.query(
            'SELECT file_name, project_id, projectNo, category, taskNo FROM project_files WHERE id = ?',
            [fileId]
        );
        if (fileInfo.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'File not found.' });
        }

        const { file_name: fileName, project_id, projectNo, category, taskNo } = fileInfo[0];

        const [deleteFileResult] = await connection.query(
            'DELETE FROM project_files WHERE id = ?',
            [fileId]
        );
        if (deleteFileResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'File record not found for deletion.' });
        }

        let taskDeleted = false;
        let wasCompleted = false;
        let panelsDeleted = 0;
        let productionRecordsDeleted = 0;

        if (category && taskNo) {
            const totalColumn = categoryToColumn[category];
            const taskTableName = taskTableMap[category];

            if (totalColumn && taskTableName) {
                const [taskStatus] = await connection.query(
                    `SELECT status FROM ${taskTableName} WHERE id = ?`,
                    [taskNo]
                );
                wasCompleted = taskStatus.length > 0 &&
                    isCompletedStatus(category, taskStatus[0].status);

                const [taskDeleteResult] = await connection.query(
                    `DELETE FROM ${taskTableName} WHERE id = ?`,
                    [taskNo]
                );
                if (taskDeleteResult.affectedRows > 0) {
                    taskDeleted = true;
                    console.log(`🗑️ Deleted linked task (ID: ${taskNo}) from ${taskTableName}`);

                    await connection.query(
                        `UPDATE projects SET ${totalColumn} = GREATEST(0, ${totalColumn} - 1) WHERE id = ?`,
                        [project_id]
                    );
                    if (wasCompleted) {
                        const completedColumn = totalColumn.replace('total_', 'completed_');
                        await connection.query(
                            `UPDATE projects SET ${completedColumn} = GREATEST(0, ${completedColumn} - 1) WHERE id = ?`,
                            [project_id]
                        );
                    }

                    if (category === 'panel') {
                        const [prodResult] = await connection.query(
                            `DELETE pr FROM production_records pr
                             JOIN panels pa ON pr.panel_id = pa.id
                             WHERE pa.project_id = ?`,
                            [project_id]
                        );
                        productionRecordsDeleted = prodResult.affectedRows;
                        console.log(`🗑️ Deleted ${productionRecordsDeleted} production record(s) for project ${projectNo}`);

                        const [panelResult] = await connection.query(
                            'DELETE FROM panels WHERE project_id = ?',
                            [project_id]
                        );
                        panelsDeleted = panelResult.affectedRows;
                        console.log(`🗑️ Deleted ${panelsDeleted} panel(s) for project ${projectNo}`);
                    }
                } else {
                    console.log(`⚠️ File deleted, but linked task (ID: ${taskNo}) not found in ${taskTableName}.`);
                }
            }
        }

        await connection.commit();
        invalidateProjectCache();

        await logActivity(
            'DELETE',
            'FILE',
            fileId,
            `Deleted file: '${fileName}' from project ${projectNo} (Category: ${category || 'N/A'}). ` +
            `Linked Task ID: ${taskNo || 'N/A'}. ` +
            `Panels deleted: ${panelsDeleted}, Production records deleted: ${productionRecordsDeleted}`,
            { projectNo, category, taskDeleted, taskNo, wasCompleted, panelsDeleted, productionRecordsDeleted }
        );

        let responseMessage = `File deleted successfully. (File: ${fileName}, Category: ${category || 'N/A'})`;
        if (taskDeleted) {
            responseMessage += ` The linked task (ID: ${taskNo}) was also deleted.`;
            if (wasCompleted) responseMessage += ` The completed count for this category was decreased.`;
        } else if (taskNo) {
            responseMessage += ` Linked Task ID ${taskNo} was not found for deletion.`;
        }
        if (panelsDeleted > 0) {
            responseMessage += ` ${panelsDeleted} panel(s) and ${productionRecordsDeleted} production record(s) were removed.`;
        }

        res.status(200).json({
            message: responseMessage,
            fileId,
            taskDeleted,
            taskNo,
            wasCompleted,
            panelsDeleted,
            productionRecordsDeleted
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error(`Error deleting file ID ${fileId}:`, err);
        res.status(500).json({
            error: 'Failed to complete file/task/panel deletion process.',
            details: err.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// =========================================================
// POST / - CREATE PROJECT
// =========================================================
router.post('/', async (req, res) => {
    let {
        drawingDate,
        projectNo,
        projectName,
        customer,
        salesman,
        poPayment,
        requestedDelivery,
        remarks,
        sell,
        cost,
        margin,
        status = 'active',
        panelRows = []
    } = req.body;

    console.log('Received project data:', req.body);

    if (!projectNo || !customer) {
        return res.status(400).json({ error: 'Project Number and Customer are required fields.' });
    }

    const safeProjectNo = projectNo.replace(/\//g, '_');

    drawingDate = drawingDate === '' ? null : drawingDate;
    requestedDelivery = requestedDelivery === '' ? null : requestedDelivery;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'projects' AND TABLE_SCHEMA = DATABASE()
        `);

        const columnNames = columns.map(col => col.COLUMN_NAME);

        let projectsColumns = ['drawingDate', 'projectNo', 'customer', 'poPayment', 'requestedDelivery', 'remarks', 'status', 'created_at'];
        let projectsPlaceholders = ['?', '?', '?', '?', '?', '?', '?', 'NOW()'];
        let projectsValues = [drawingDate, safeProjectNo, customer, poPayment, requestedDelivery, remarks, status];

        if (columnNames.includes('projectName')) {
            projectsColumns.push('projectName');
            projectsPlaceholders.push('?');
            projectsValues.push(projectName || '');
        }

        if (columnNames.includes('salesman')) {
            projectsColumns.push('salesman');
            projectsPlaceholders.push('?');
            projectsValues.push(salesman || '');
        }

        const completionFields = [
            'completed_cutting', 'completed_panel', 'completed_door',
            'completed_strip_curtain', 'completed_accessories',
            'completed_system', 'completed_transportation', 'completed_quotation'
        ];

        completionFields.forEach(field => {
            if (columnNames.includes(field)) {
                projectsColumns.push(field);
                projectsPlaceholders.push('?');
                projectsValues.push(req.body[field] || 0);
            }
        });

        const projectsQuery = `INSERT INTO projects 
            (${projectsColumns.join(', ')})
            VALUES (${projectsPlaceholders.join(', ')})`;

        const [projectsResult] = await connection.query(projectsQuery, projectsValues);
        const projectId = projectsResult.insertId;

        const [tables] = await connection.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_ledger'
        `);

        if (tables.length > 0) {
            const [ledgerColumns] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'job_ledger' AND TABLE_SCHEMA = DATABASE()
            `);
            const ledgerColNames = ledgerColumns.map(c => c.COLUMN_NAME);

            const ledgerData = {
                Job_No: safeProjectNo,
                Customer_Name: customer,
                Date_Entry: drawingDate || new Date().toISOString().split('T')[0],
                Sell_Price: sell || 0,
                Cost: cost || 0,
                Margin: margin || 0,
                Remarks: remarks || null
            };
            if (ledgerColNames.includes('project_id')) {
                ledgerData.project_id = projectId;
            }

            const sqlColumns = Object.keys(ledgerData).join(', ');
            const placeholders = Object.keys(ledgerData).map(() => '?').join(', ');
            const ledgerValues = Object.values(ledgerData);

            await connection.query(`INSERT INTO job_ledger (${sqlColumns}) VALUES (${placeholders})`, ledgerValues);
        }

        if (Array.isArray(panelRows) && panelRows.length > 0) {
            const generatePanelRef = (existingRefs = []) => {
                const now = new Date();
                const y = now.getFullYear().toString().slice(-2);
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                const prefix = `REF-${y}${m}${d}`;
                const todayRefs = existingRefs.filter(r => r && r.startsWith(prefix));
                let seq = 1;
                if (todayRefs.length > 0) {
                    const nums = todayRefs.map(r => { const x = r.match(/\d+$/); return x ? parseInt(x[0]) : 0; });
                    seq = Math.max(...nums) + 1;
                }
                return `${prefix}-${String(seq).padStart(3, '0')}`;
            };

            const [existingPanels] = await connection.query(
                'SELECT reference_number FROM panels WHERE reference_number IS NOT NULL'
            );
            const existingRefs = existingPanels.map(p => p.reference_number).filter(Boolean);
            const usedRefs = [...existingRefs];

            for (const row of panelRows) {
                const qty = parseInt(row.qty) || 0;
                if (qty <= 0) continue;

                if (!row.width || !row.length) {
                    throw new Error('Width and Length are required for each panel row when qty > 0.');
                }

                for (let i = 0; i < qty; i++) {
                    const ref = generatePanelRef(usedRefs);
                    usedRefs.push(ref);

                    const panelData = {
                        project_id: projectId,
                        job_no: safeProjectNo,
                        reference_number: ref,
                        type: row.type || null,
                        panel_thk: row.thk ? parseFloat(row.thk) : null,
                        joint: row.joint || null,
                        surface_front: row.front || null,
                        surface_back: row.back || null,
                        surface_front_thk: row.frontThk ? parseFloat(row.frontThk) : null,
                        surface_back_thk: row.backThk ? parseFloat(row.backThk) : null,
                        surface_type: row.surface || null,
                        width: parseFloat(row.width) || 0,
                        length: parseFloat(row.length) || 0,
                        qty: 1,
                        balance: 1,
                        cutting: row.cutting || null,
                        salesman: row.salesman || null,
                        application: row.application || null,
                        estimated_delivery: row.delivery || null,
                        notes: row.notes || null,
                        status: 'on-hold',
                        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
                    };

                    Object.keys(panelData).forEach(key => {
                        if (panelData[key] === null || panelData[key] === undefined) {
                            delete panelData[key];
                        }
                    });

                    const columns = Object.keys(panelData);
                    const values = Object.values(panelData);
                    const placeholders = columns.map(() => '?').join(', ');
                    await connection.query(
                        `INSERT INTO panels (${columns.join(', ')}) VALUES (${placeholders})`,
                        values
                    );
                }
            }
        }

        await connection.commit();
        invalidateProjectCache();

        const [newProject] = await connection.query('SELECT * FROM projects WHERE id = ?', [projectId]);
        res.status(201).json(newProject[0]);

    } catch (err) {
        await connection.rollback();
        console.error('Database Error:', err);

        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `Project Number '${safeProjectNo}' already exists.` });
        }
        res.status(500).json({ error: 'Failed to create project.', details: err.message });
    } finally {
        connection.release();
    }
});

// =========================================================
// PATCH /:id/status - Update project status
// =========================================================
router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required.' });
    }

    try {
        const updateQuery = `
            UPDATE projects 
            SET status = ?, updated_at = NOW()
            WHERE id = ?
        `;

        await db.query(updateQuery, [status, id]);

        const [updatedProject] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);

        if (updatedProject.length === 0) {
            return res.status(404).json({ error: 'Project not found after status update attempt.' });
        }

        invalidateProjectCache();

        await logActivity(
            'UPDATE',
            'PROJECT',
            id,
            `Project ${updatedProject[0].projectNo} status updated to ${status}.`,
            { oldStatus: updatedProject[0].status, newStatus: status }
        );

        res.status(200).json(updatedProject[0]);

    } catch (err) {
        console.error('Error updating project status:', err);
        res.status(500).json({
            error: 'Failed to update project status.',
            details: err.message
        });
    }
});

// =========================================================
// PUT /:id - UPDATE PROJECT (full)
// =========================================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const updateFields = req.body;
    const panelRows = updateFields.panelRows;

    const formatDate = (dateValue) => {
        if (!dateValue) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const allowedFields = [
        'drawingDate', 'projectNo', 'customer', 'poPayment',
        'requestedDelivery', 'remarks', 'salesman', 'projectName'
    ];
    const fieldsToUpdate = {};

    allowedFields.forEach(field => {
        if (updateFields[field] !== undefined) {
            if (field === 'drawingDate' || field === 'requestedDelivery') {
                const formatted = formatDate(updateFields[field]);
                if (formatted !== null) {
                    fieldsToUpdate[field] = formatted;
                }
            } else {
                fieldsToUpdate[field] = updateFields[field];
            }
        }
    });

    const ledgerFields = ['sales', 'sell', 'cost', 'margin'];
    const hasLedgerUpdate = ledgerFields.some(f => updateFields[f] !== undefined);

    if (Object.keys(fieldsToUpdate).length === 0 && panelRows === undefined && !hasLedgerUpdate) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [currentProject] = await connection.query(
            'SELECT id, projectNo, customer, drawingDate, remarks FROM projects WHERE id = ?',
            [id]
        );
        if (currentProject.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Project not found.' });
        }
        const oldProject = currentProject[0];
        const oldProjectNo = oldProject.projectNo;

        if (Object.keys(fieldsToUpdate).length > 0) {
            if (fieldsToUpdate.projectNo && fieldsToUpdate.projectNo !== oldProjectNo) {
                const [dup] = await connection.query(
                    'SELECT id FROM projects WHERE projectNo = ? AND id != ?',
                    [fieldsToUpdate.projectNo, id]
                );
                if (dup.length > 0) {
                    await connection.rollback();
                    return res.status(409).json({ error: 'Project number already exists.' });
                }
            }

            const setClause = Object.keys(fieldsToUpdate)
                .map(field => `${field} = ?`)
                .join(', ');
            const query = `UPDATE projects SET ${setClause}, updated_at = NOW() WHERE id = ?`;
            const values = [...Object.values(fieldsToUpdate), id];
            await connection.query(query, values);
        }

        const newProjectNo = fieldsToUpdate.projectNo || oldProjectNo;
        const projectNoChanged = (newProjectNo !== oldProjectNo);

        if (projectNoChanged) {
            const taskTables = [
                'panel_tasks', 'cutting_tasks', 'door_tasks',
                'strip_curtain_tasks', 'accessories_tasks',
                'system_tasks', 'transportation_tasks', 'quotation_tasks'
            ];
            for (const table of taskTables) {
                await connection.query(
                    `UPDATE ${table} SET project_no = ? WHERE project_id = ?`,
                    [newProjectNo, id]
                );
            }
            await connection.query(
                'UPDATE panels SET job_no = ? WHERE project_id = ?',
                [newProjectNo, id]
            );
            await connection.query(
                'UPDATE project_files SET projectNo = ? WHERE project_id = ?',
                [newProjectNo, id]
            );
        }

        const [ledgerTables] = await connection.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_ledger'
        `);
        if (ledgerTables.length > 0) {
            const [ledgerColumns] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'job_ledger' AND TABLE_SCHEMA = DATABASE()
            `);
            const ledgerColNames = ledgerColumns.map(c => c.COLUMN_NAME);

            const ledgerUpdate = {};
            if (updateFields.projectNo) ledgerUpdate.Job_No = updateFields.projectNo;
            if (updateFields.customer) ledgerUpdate.Customer_Name = updateFields.customer;
            if (updateFields.sales !== undefined) ledgerUpdate.Sales_Amount = updateFields.sales;
            if (updateFields.sell !== undefined) ledgerUpdate.Sell_Price = updateFields.sell;
            if (updateFields.cost !== undefined) ledgerUpdate.Cost = updateFields.cost;
            if (updateFields.margin !== undefined) ledgerUpdate.Margin = updateFields.margin;
            if (updateFields.remarks !== undefined) ledgerUpdate.Remarks = updateFields.remarks;
            if (updateFields.drawingDate !== undefined) {
                const formatted = formatDate(updateFields.drawingDate);
                if (formatted) ledgerUpdate.Date_Entry = formatted;
            }

            const [ledgerExists] = await connection.query(
                'SELECT id FROM job_ledger WHERE project_id = ?',
                [id]
            );

            if (ledgerExists.length > 0) {
                if (Object.keys(ledgerUpdate).length > 0) {
                    const setClause = Object.keys(ledgerUpdate)
                        .map(f => `${f} = ?`)
                        .join(', ');
                    const values = [...Object.values(ledgerUpdate), id];
                    await connection.query(
                        `UPDATE job_ledger SET ${setClause} WHERE project_id = ?`,
                        values
                    );
                }
            } else {
                const newLedger = {
                    project_id: id,
                    Job_No: newProjectNo,
                    Customer_Name: updateFields.customer || oldProject.customer,
                    Date_Entry: updateFields.drawingDate
                        ? formatDate(updateFields.drawingDate)
                        : (oldProject.drawingDate || new Date().toISOString().split('T')[0]),
                    Sales_Amount: updateFields.sales !== undefined ? updateFields.sales : 0,
                    Sell_Price: updateFields.sell !== undefined ? updateFields.sell : 0,
                    Cost: updateFields.cost !== undefined ? updateFields.cost : 0,
                    Margin: updateFields.margin !== undefined ? updateFields.margin : 0,
                    Remarks: updateFields.remarks !== undefined ? updateFields.remarks : (oldProject.remarks || null),
                };
                const finalLedger = {};
                Object.keys(newLedger).forEach(key => {
                    if (ledgerColNames.includes(key)) {
                        finalLedger[key] = newLedger[key];
                    }
                });
                const cols = Object.keys(finalLedger);
                const vals = Object.values(finalLedger);
                const placeholders = cols.map(() => '?').join(', ');
                await connection.query(
                    `INSERT INTO job_ledger (${cols.join(', ')}) VALUES (${placeholders})`,
                    vals
                );
            }
        }

        if (panelRows !== undefined) {
            await connection.query('DELETE FROM panels WHERE project_id = ?', [id]);

            const generatePanelRef = (existingRefs = []) => {
                const now = new Date();
                const y = now.getFullYear().toString().slice(-2);
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                const prefix = `REF-${y}${m}${d}`;
                const todayRefs = existingRefs.filter(r => r && r.startsWith(prefix));
                let seq = 1;
                if (todayRefs.length > 0) {
                    const nums = todayRefs.map(r => { const x = r.match(/\d+$/); return x ? parseInt(x[0]) : 0; });
                    seq = Math.max(...nums) + 1;
                }
                return `${prefix}-${String(seq).padStart(3, '0')}`;
            };

            const [allRefs] = await connection.query(
                'SELECT reference_number FROM panels WHERE reference_number IS NOT NULL'
            );
            const usedRefs = allRefs.map(p => p.reference_number).filter(Boolean);

            for (const row of panelRows) {
                if (!row.width || !row.length) {
                    throw new Error('Width and Length are required for each panel.');
                }

                const ref = generatePanelRef(usedRefs);
                usedRefs.push(ref);

                const panelData = {
                    project_id: id,
                    job_no: newProjectNo,
                    reference_number: ref,
                    type: row.type || null,
                    panel_thk: row.thk ? parseFloat(row.thk) : null,
                    joint: row.joint || null,
                    surface_front: row.front || null,
                    surface_back: row.back || null,
                    surface_front_thk: row.frontThk ? parseFloat(row.frontThk) : null,
                    surface_back_thk: row.backThk ? parseFloat(row.backThk) : null,
                    surface_type: row.surface || null,
                    width: parseFloat(row.width) || 0,
                    length: parseFloat(row.length) || 0,
                    qty: 1,
                    balance: 1,
                    cutting: row.cutting || null,
                    salesman: row.salesman || null,
                    application: row.application || null,
                    estimated_delivery: row.delivery || null,
                    notes: row.notes || null,
                    status: row.status || 'pending',
                    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
                };

                Object.keys(panelData).forEach(key => {
                    if (panelData[key] === null || panelData[key] === undefined) {
                        delete panelData[key];
                    }
                });

                const columns = Object.keys(panelData);
                const values = Object.values(panelData);
                const placeholders = columns.map(() => '?').join(', ');
                await connection.query(
                    `INSERT INTO panels (${columns.join(', ')}) VALUES (${placeholders})`,
                    values
                );
            }
        }

        await connection.commit();
        invalidateProjectCache();

        const [updatedProject] = await connection.query('SELECT * FROM projects WHERE id = ?', [id]);

        await logActivity(
            'UPDATE',
            'PROJECT',
            id,
            `Project ${updatedProject[0].projectNo} updated.`,
            {
                fieldsUpdated: Object.keys(fieldsToUpdate),
                panelRowsProvided: panelRows !== undefined,
                ledgerUpdated: hasLedgerUpdate,
                projectNoChanged
            }
        );

        res.status(200).json(updatedProject[0]);

    } catch (err) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Error updating project:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Duplicate entry (e.g., projectNo already exists).' });
        }
        res.status(500).json({
            error: 'Failed to update project data in the database.',
            details: err.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// =========================================================
// DELETE /:identifier - DELETE PROJECT (full cleanup)
// =========================================================
router.delete('/:identifier', async (req, res) => {
    const { identifier } = req.params;
    let projectId;
    let projectNo;
    let customer;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        let project;
        if (/^\d+$/.test(identifier)) {
            [project] = await connection.query(
                'SELECT id, projectNo, customer FROM projects WHERE id = ?',
                [parseInt(identifier, 10)]
            );
        } else {
            [project] = await connection.query(
                'SELECT id, projectNo, customer FROM projects WHERE projectNo = ?',
                [identifier]
            );
        }
        if (!project || project.length === 0) {
            throw new Error(`Project with identifier ${identifier} not found.`);
        }
        projectId = project[0].id;
        projectNo = project[0].projectNo;
        customer = project[0].customer;

        console.log(`🗑️ Starting full deletion of project ID: ${projectId} (${projectNo})`);

        // 1. Delete production records
        const [prodResult] = await connection.query(
            `DELETE pr FROM production_records pr
             JOIN panels pa ON pr.panel_id = pa.id
             WHERE pa.project_id = ?`,
            [projectId]
        );
        if (prodResult.affectedRows > 0) {
            console.log(`🗑️ Deleted ${prodResult.affectedRows} production records`);
        }

        // 2. Delete panels
        const [panelsResult] = await connection.query(
            'DELETE FROM panels WHERE project_id = ?',
            [projectId]
        );
        if (panelsResult.affectedRows > 0) {
            console.log(`🗑️ Deleted ${panelsResult.affectedRows} panels`);
        }

        // 3. Delete tasks from all category tables
        const taskTables = [
            'panel_tasks', 'cutting_tasks', 'door_tasks',
            'strip_curtain_tasks', 'accessories_tasks',
            'system_tasks', 'transportation_tasks', 'quotation_tasks'
        ];

        const taskDeletePromises = taskTables.map(table =>
            connection.query(`DELETE FROM ${table} WHERE project_id = ?`, [projectId])
        );
        const taskResults = await Promise.all(taskDeletePromises);

        let totalTaskRows = 0;
        taskResults.forEach(([result], index) => {
            if (result.affectedRows > 0) {
                console.log(`🗑️ Deleted ${result.affectedRows} rows from ${taskTables[index]}`);
                totalTaskRows += result.affectedRows;
            }
        });
        console.log(`🗑️ Total tasks deleted: ${totalTaskRows}`);

        // 4. Delete project_files
        const [filesResult] = await connection.query(
            'DELETE FROM project_files WHERE project_id = ?',
            [projectId]
        );
        console.log(`🗑️ Deleted ${filesResult.affectedRows} file(s) from project_files.`);

        // 5. Delete job_ledger
        const [tables] = await connection.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_ledger'
        `);
        if (tables.length > 0) {
            const [ledgerResult] = await connection.query(
                'DELETE FROM job_ledger WHERE project_id = ?',
                [projectId]
            );
            if (ledgerResult.affectedRows > 0) {
                console.log(`🗑️ Deleted ${ledgerResult.affectedRows} record(s) from job_ledger.`);
            }
        }

        // 6. Delete the project itself
        const [projectResult] = await connection.query(
            'DELETE FROM projects WHERE id = ?',
            [projectId]
        );
        if (projectResult.affectedRows === 0) {
            throw new Error('Failed to delete project from database.');
        }

        await connection.commit();
        invalidateProjectCache();

        console.log(`✅ Transaction committed. Project ${projectNo} fully deleted.`);

        await logActivity(
            'DELETE',
            'PROJECT',
            projectId,
            `Project ${projectNo} (${customer}) deleted with all related data.`,
            { projectNo, customer }
        );

        res.status(200).json({
            success: true,
            message: `Project ${projectNo} (${customer}) deleted successfully.`,
            projectNo,
            customer,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('❌ Error in project deletion:', err);
        res.status(500).json({
            error: 'Failed to delete project and all associated data.',
            details: err.message,
            identifier: identifier,
            timestamp: new Date().toISOString()
        });
    } finally {
        if (connection) connection.release();
    }
});

// =========================================================
// 📁 GET FILE BLOB
// =========================================================
router.get('/file/blob/:id', async (req, res) => {
    const fileId = req.params.id;

    try {
        const [fileResult] = await db.query(
            'SELECT file_name, mime_type, file_data FROM project_files WHERE id = ?',
            [fileId]
        );

        if (fileResult.length === 0) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const file = fileResult[0];

        if (!file.file_data) {
            return res.status(404).json({ error: 'File data is empty or missing.' });
        }

        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);

        res.send(file.file_data);

    } catch (err) {
        console.error(`Error retrieving file BLOB ID ${fileId}:`, err);
        res.status(500).json({
            error: 'Failed to retrieve file BLOB from the database.',
            details: err.message
        });
    }
});

// =========================================================
// 📊 GET COMPLETION PERCENTAGES
// =========================================================
router.get('/completion/:projectNo', async (req, res) => {
    try {
        const { projectNo } = req.params;

        const [project] = await db.query(
            'SELECT id FROM projects WHERE projectNo = ?',
            [projectNo]
        );

        if (project.length === 0) {
            return res.status(404).json({
                error: `Project with number ${projectNo} not found`
            });
        }

        const completion = await calculateCompletionPercentage(project[0].id);

        res.json(completion);
    } catch (error) {
        console.error('Error fetching project completion:', error);
        res.status(500).json({
            error: 'Failed to fetch project completion data',
            details: error.message
        });
    }
});

// =========================================================
// EXPORT
// =========================================================
module.exports = router;
module.exports.invalidateProjectCache = invalidateProjectCache;