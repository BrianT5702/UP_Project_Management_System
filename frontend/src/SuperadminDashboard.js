import React, { useCallback, useEffect, useState } from 'react';
import { superadminAPI } from './apiService';
import './SuperadminDashboard.css';

const TABS = [
    { id: 'users', label: 'All users', icon: '👥' },
    { id: 'signups', label: 'Signup approvals', icon: '✅' },
    { id: 'resets', label: 'Password resets', icon: '🔑' },
    { id: 'locked', label: 'Locked accounts', icon: '🔒' },
];

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return String(value);
    }
};

const statusLabel = (status) => {
    const map = {
        pending: 'Pending',
        active: 'Active',
        rejected: 'Rejected',
        locked: 'Locked',
    };
    return map[status] || status || '—';
};

function ApprovalPills({ approvals = [], required = 2 }) {
    if (!approvals.length) {
        return <span className="sa-muted">No acknowledgements yet ({0}/{required})</span>;
    }
    return (
        <div className="sa-pills">
            {approvals.map((vote) => (
                <span key={vote.id} className="sa-pill">✓ {vote.username}</span>
            ))}
            <span className="sa-muted">{approvals.length}/{required}</span>
        </div>
    );
}

function SuperadminDashboard() {
    const [tab, setTab] = useState('users');
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busyKey, setBusyKey] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const loadDashboard = useCallback(async () => {
        setError('');
        try {
            const next = await superadminAPI.getDashboard();
            setData(next);
        } catch (err) {
            setError(err.message || 'Failed to load superadmin dashboard');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const runAction = async (key, action) => {
        setBusyKey(key);
        setError('');
        setNotice('');
        try {
            const result = await action();
            setNotice(result?.message || 'Updated');
            await loadDashboard();
        } catch (err) {
            setError(err.message || 'Action failed');
        } finally {
            setBusyKey('');
        }
    };

    const pendingSignups = data?.pendingSignups || [];
    const pendingResets = data?.pendingResets || [];
    const lockedUsers = data?.lockedUsers || [];
    const users = data?.users || [];
    const required = data?.requiredApprovals || 2;
    const tabCounts = {
        users: users.length,
        signups: pendingSignups.length,
        resets: pendingResets.length,
        locked: lockedUsers.length,
    };

    return (
        <div className="sa-page">
            <div className="page-header">
                <div className="page-header-left">
                    <h1 className="page-title">Superadmin</h1>
                    <p className="page-subtitle">
                        Signup, password reset, and unlock actions need two superadmin acknowledgements.
                        {data?.me?.username ? ` Signed in as ${data.me.username}.` : ''}
                    </p>
                </div>
                <button type="button" className="sa-refresh" onClick={loadDashboard} disabled={isLoading}>
                    Refresh
                </button>
            </div>

            {error && <div className="sa-banner sa-banner-error">{error}</div>}
            {notice && <div className="sa-banner sa-banner-ok">{notice}</div>}

            <div className="sa-layout">
                <aside className="sa-rail">
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`sa-rail-item ${tab === item.id ? 'active' : ''}`}
                            onClick={() => setTab(item.id)}
                        >
                            <span className="sa-rail-icon">{item.icon}</span>
                            <span className="sa-rail-copy">
                                <strong>{item.label}</strong>
                                <em>{tabCounts[item.id] ?? 0}</em>
                            </span>
                        </button>
                    ))}
                </aside>
                <div className="sa-main">
            {isLoading && !data ? (
                <div className="sa-empty">Loading superadmin data…</div>
            ) : tab === 'signups' ? (
                <section className="sa-card">
                    <h2>Account signup approval</h2>
                    <p>New accounts stay pending until two superadmins approve.</p>
                    {pendingSignups.length === 0 ? (
                        <div className="sa-empty">No pending signups.</div>
                    ) : (
                        <div className="sa-table-wrap">
                            <table className="sa-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Position</th>
                                        <th>Requested</th>
                                        <th>Acknowledgements</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingSignups.map((user) => (
                                        <tr key={user.id}>
                                            <td><strong>{user.username}</strong></td>
                                            <td>{user.position}</td>
                                            <td>{formatDate(user.created_at)}</td>
                                            <td><ApprovalPills approvals={user.approvals} required={required} /></td>
                                            <td className="sa-actions">
                                                <button
                                                    type="button"
                                                    className="sa-btn sa-btn-primary"
                                                    disabled={busyKey === `signup-${user.id}` || user.approvedByMe}
                                                    onClick={() => runAction(`signup-${user.id}`, () => superadminAPI.approveSignup(user.id))}
                                                >
                                                    {user.approvedByMe ? 'Waiting for 2nd' : 'Acknowledge / approve'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sa-btn sa-btn-danger"
                                                    disabled={Boolean(busyKey)}
                                                    onClick={() => runAction(`reject-${user.id}`, () => superadminAPI.rejectSignup(user.id))}
                                                >
                                                    Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : tab === 'resets' ? (
                <section className="sa-card">
                    <h2>Password reset approval</h2>
                    <p>The new password is applied only after two superadmins acknowledge the request.</p>
                    {pendingResets.length === 0 ? (
                        <div className="sa-empty">No pending password resets.</div>
                    ) : (
                        <div className="sa-table-wrap">
                            <table className="sa-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Position</th>
                                        <th>Requested</th>
                                        <th>Acknowledgements</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingResets.map((reset) => (
                                        <tr key={reset.id}>
                                            <td><strong>{reset.username}</strong></td>
                                            <td>{reset.position}</td>
                                            <td>{formatDate(reset.created_at)}</td>
                                            <td><ApprovalPills approvals={reset.approvals} required={required} /></td>
                                            <td className="sa-actions">
                                                <button
                                                    type="button"
                                                    className="sa-btn sa-btn-primary"
                                                    disabled={busyKey === `reset-${reset.id}` || reset.approvedByMe}
                                                    onClick={() => runAction(`reset-${reset.id}`, () => superadminAPI.approvePasswordReset(reset.id))}
                                                >
                                                    {reset.approvedByMe ? 'Waiting for 2nd' : 'Acknowledge / approve'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sa-btn sa-btn-danger"
                                                    disabled={Boolean(busyKey)}
                                                    onClick={() => runAction(`reset-reject-${reset.id}`, () => superadminAPI.rejectPasswordReset(reset.id))}
                                                >
                                                    Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : tab === 'locked' ? (
                <section className="sa-card">
                    <h2>Locked accounts</h2>
                    <p>Three consecutive wrong passwords lock the account. Two superadmins must unblock it, then the user is prompted to reset their password.</p>
                    {lockedUsers.length === 0 ? (
                        <div className="sa-empty">No locked accounts.</div>
                    ) : (
                        <div className="sa-table-wrap">
                            <table className="sa-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Position</th>
                                        <th>Failed attempts</th>
                                        <th>Acknowledgements</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lockedUsers.map((user) => (
                                        <tr key={user.id}>
                                            <td><strong>{user.username}</strong></td>
                                            <td>{user.position}</td>
                                            <td>{user.failed_login_attempts || 0}</td>
                                            <td><ApprovalPills approvals={user.approvals} required={required} /></td>
                                            <td className="sa-actions">
                                                <button
                                                    type="button"
                                                    className="sa-btn sa-btn-primary"
                                                    disabled={busyKey === `unblock-${user.id}` || user.approvedByMe}
                                                    onClick={() => runAction(`unblock-${user.id}`, () => superadminAPI.unblockUser(user.id))}
                                                >
                                                    {user.approvedByMe ? 'Waiting for 2nd' : 'Unblock'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : (
                <section className="sa-card">
                    <h2>All users</h2>
                    <div className="sa-table-wrap">
                        <table className="sa-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Position</th>
                                    <th>Status</th>
                                    <th>Must reset</th>
                                    <th>Failed attempts</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td><strong>{user.username}</strong></td>
                                        <td>{user.position}</td>
                                        <td>
                                            <span className={`sa-status sa-status-${user.status}`}>
                                                {statusLabel(user.status)}
                                            </span>
                                        </td>
                                        <td>{Number(user.must_reset_password) === 1 ? 'Yes' : 'No'}</td>
                                        <td>{user.failed_login_attempts || 0}</td>
                                        <td>{formatDate(user.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
                )}
                </div>
            </div>
        </div>
    );
}

export default SuperadminDashboard;
