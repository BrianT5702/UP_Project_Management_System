const bcrypt = require('bcrypt');
const db = require('../db/connection');

const SALT_ROUNDS = 10;

const DEFAULT_SUPERADMINS = [
    {
        username: process.env.SUPERADMIN_1_USER || 'superadmin1',
        password: process.env.SUPERADMIN_1_PASSWORD || 'SuperAdmin1',
    },
    {
        username: process.env.SUPERADMIN_2_USER || 'superadmin2',
        password: process.env.SUPERADMIN_2_PASSWORD || 'SuperAdmin2',
    },
];

async function columnExists(table, column) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS n
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [table, column]
    );
    return Number(rows[0].n) > 0;
}

async function addColumnIfMissing(table, column, definition) {
    if (await columnExists(table, column)) return;
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    console.log(`✅ Added ${table}.${column}`);
}

async function ensureColumnAllowsValue(table, column, extraValue) {
    const [rows] = await db.query(
        `SELECT COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [table, column]
    );
    if (!rows.length) return;
    const columnType = String(rows[0].COLUMN_TYPE || '');
    const dataType = String(rows[0].DATA_TYPE || '').toLowerCase();
    if (dataType !== 'enum') return;
    if (columnType.includes(`'${extraValue}'`)) return;
    const values = [...columnType.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    if (!values.includes(extraValue)) values.push(extraValue);
    const nextType = `ENUM(${values.map((value) => `'${value}'`).join(',')})`;
    const nullable = rows[0].IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultSql = rows[0].COLUMN_DEFAULT != null ? ` DEFAULT '${rows[0].COLUMN_DEFAULT}'` : '';
    await db.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${nextType} ${nullable}${defaultSql}`);
    console.log(`✅ Updated ${table}.${column} enum to include ${extraValue}`);
}

async function ensureSuperadminInfrastructure() {
    await addColumnIfMissing(
        'users',
        'failed_login_attempts',
        'failed_login_attempts INT NOT NULL DEFAULT 0'
    );
    await addColumnIfMissing(
        'users',
        'must_reset_password',
        'must_reset_password TINYINT(1) NOT NULL DEFAULT 0'
    );
    await ensureColumnAllowsValue('users', 'position', 'superadmin');
    await ensureColumnAllowsValue('users', 'status', 'locked');

    await db.query(`
        CREATE TABLE IF NOT EXISTS password_reset_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            new_password_hash VARCHAR(255) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_reset_user_status (user_id, status)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS superadmin_approvals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            action_type VARCHAR(32) NOT NULL,
            target_user_id INT NOT NULL,
            related_id INT NOT NULL DEFAULT 0,
            approver_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_vote (action_type, target_user_id, related_id, approver_id),
            INDEX idx_vote_lookup (action_type, target_user_id, related_id)
        )
    `);

    for (const account of DEFAULT_SUPERADMINS) {
        const [existing] = await db.query(
            'SELECT id FROM users WHERE username = ?',
            [account.username]
        );
        if (existing.length > 0) continue;

        const hashedPassword = await bcrypt.hash(account.password, SALT_ROUNDS);
        await db.query(
            `INSERT INTO users (username, password_hash, position, status, failed_login_attempts, must_reset_password)
             VALUES (?, ?, 'superadmin', 'active', 0, 0)`,
            [account.username, hashedPassword]
        );
        console.log(`✅ Seeded superadmin account: ${account.username}`);
    }
}

module.exports = {
    ensureSuperadminInfrastructure,
    DEFAULT_SUPERADMINS,
    APPROVALS_REQUIRED: 2,
    LOCK_AFTER_ATTEMPTS: 3,
};
