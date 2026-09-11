import React, { useCallback, useEffect, useState } from 'react';
import { superadminAPI } from './apiService';
import './SuperadminDashboard.css';

const TABS = [
    { id: 'users', label: 'Users' },
    { id: 'signups', label: 'Signups' },
    { id: 'resets', label: 'Resets' },
    { id: 'locked', label: 'Locked' },
];

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
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

function VoteStatus({ approvals = [], required = 2 }) {
    const names = approvals.map((vote) => vote.username).join(', ');
    return (
        <span className="sa-votes" title={names || 'No votes yet'}>
            {approvals.length}/{required}
            {names ? ` · ${names}` : ''}
        </span>
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

    const renderPanel = () => {
        if (isLoading && !data) {
            return <div className="sa-empty">Loading…</div>;
        }

        if (tab === 'signups') {
            return (
                <table className="sa-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Position</th>
                            <th>Requested</th>
                            <th>Votes</th>
                            <th className="sa-col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingSignups.length === 0 ? (
                            <tr><td colSpan="5" className="sa-empty-cell">No pending signups</td></tr>
                        ) : pendingSignups.map((user) => (
                            <tr key={user.id}>
                                <td>{user.username}</td>
                                <td>{user.position}</td>
                                <td>{formatDate(user.created_at)}</td>
                                <td><VoteStatus approvals={user.approvals} required={required} /></td>
                                <td className="sa-col-actions">
                                    <div className="sa-actions">
                                        <button
                                            type="button"
                                            className="sa-btn sa-btn-primary"
                                            disabled={busyKey === `signup-${user.id}` || user.approvedByMe}
                                            onClick={() => runAction(`signup-${user.id}`, () => superadminAPI.approveSignup(user.id))}
                                        >
                                            {user.approvedByMe ? 'Waiting' : 'Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            className="sa-btn sa-btn-danger"
                                            disabled={Boolean(busyKey)}
                                            onClick={() => runAction(`reject-${user.id}`, () => superadminAPI.rejectSignup(user.id))}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        if (tab === 'resets') {
            return (
                <table className="sa-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Position</th>
                            <th>Requested</th>
                            <th>Votes</th>
                            <th className="sa-col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingResets.length === 0 ? (
                            <tr><td colSpan="5" className="sa-empty-cell">No pending password resets</td></tr>
                        ) : pendingResets.map((reset) => (
                            <tr key={reset.id}>
                                <td>{reset.username}</td>
                                <td>{reset.position}</td>
                                <td>{formatDate(reset.created_at)}</td>
                                <td><VoteStatus approvals={reset.approvals} required={required} /></td>
                                <td className="sa-col-actions">
                                    <div className="sa-actions">
                                        <button
                                            type="button"
                                            className="sa-btn sa-btn-primary"
                                            disabled={busyKey === `reset-${reset.id}` || reset.approvedByMe}
                                            onClick={() => runAction(`reset-${reset.id}`, () => superadminAPI.approvePasswordReset(reset.id))}
                                        >
                                            {reset.approvedByMe ? 'Waiting' : 'Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            className="sa-btn sa-btn-danger"
                                            disabled={Boolean(busyKey)}
                                            onClick={() => runAction(`reset-reject-${reset.id}`, () => superadminAPI.rejectPasswordReset(reset.id))}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        if (tab === 'locked') {
            return (
                <table className="sa-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Position</th>
                            <th>Attempts</th>
                            <th>Votes</th>
                            <th className="sa-col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lockedUsers.length === 0 ? (
                            <tr><td colSpan="5" className="sa-empty-cell">No locked accounts</td></tr>
                        ) : lockedUsers.map((user) => (
                            <tr key={user.id}>
                                <td>{user.username}</td>
                                <td>{user.position}</td>
                                <td>{user.failed_login_attempts || 0}</td>
                                <td><VoteStatus approvals={user.approvals} required={required} /></td>
                                <td className="sa-col-actions">
                                    <div className="sa-actions">
                                        <button
                                            type="button"
                                            className="sa-btn sa-btn-primary"
                                            disabled={busyKey === `unblock-${user.id}` || user.approvedByMe}
                                            onClick={() => runAction(`unblock-${user.id}`, () => superadminAPI.unblockUser(user.id))}
                                        >
                                            {user.approvedByMe ? 'Waiting' : 'Unblock'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        return (
            <table className="sa-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Position</th>
                        <th>Status</th>
                        <th>Reset</th>
                        <th>Attempts</th>
                        <th>Created</th>
                        <th className="sa-col-actions">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.length === 0 ? (
                        <tr><td colSpan="7" className="sa-empty-cell">No users</td></tr>
                    ) : users.map((user) => {
                        const isProtected = String(user.position).toLowerCase() === 'superadmin' || user.id === data?.me?.id;
                        return (
                            <tr key={user.id}>
                                <td>{user.username}</td>
                                <td>{user.position}</td>
                                <td>
                                    <span className={`sa-status sa-status-${user.status}`}>
                                        {statusLabel(user.status)}
                                    </span>
                                </td>
                                <td>{Number(user.must_reset_password) === 1 ? 'Yes' : '—'}</td>
                                <td>{user.failed_login_attempts || 0}</td>
                                <td>{formatDate(user.created_at)}</td>
                                <td className="sa-col-actions">
                                    {isProtected ? (
                                        <span className="sa-muted">—</span>
                                    ) : (
                                        <div className="sa-actions">
                                            <button
                                                type="button"
                                                className="sa-btn sa-btn-danger"
                                                disabled={busyKey === `delete-${user.id}`}
                                                onClick={() => {
                                                    if (!window.confirm(`Remove account "${user.username}"? This cannot be undone.`)) return;
                                                    runAction(`delete-${user.id}`, () => superadminAPI.deleteUser(user.id));
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    return (
        <div className="sa-page">
            <div className="sa-top">
                <div>
                    <h1 className="sa-title">Superadmin</h1>
                    <p className="sa-hint">
                        Approvals need two superadmins
                        {data?.me?.username ? ` · ${data.me.username}` : ''}
                    </p>
                </div>
                <button type="button" className="sa-btn sa-btn-ghost" onClick={loadDashboard} disabled={isLoading}>
                    Refresh
                </button>
            </div>

            {error && <div className="sa-banner sa-banner-error">{error}</div>}
            {notice && <div className="sa-banner sa-banner-ok">{notice}</div>}

            <div className="sa-tabs">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`sa-tab ${tab === item.id ? 'active' : ''}`}
                        onClick={() => setTab(item.id)}
                    >
                        {item.label}
                        <span>{tabCounts[item.id] ?? 0}</span>
                    </button>
                ))}
            </div>

            <div className="sa-panel">
                {renderPanel()}
            </div>
        </div>
    );
}

export default SuperadminDashboard;
