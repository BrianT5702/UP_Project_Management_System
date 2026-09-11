import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Bell, CheckCircle, AlertTriangle, MessageSquare, 
    Briefcase, Loader2, Search, Calendar, RefreshCw,
    Check, AlertCircle
} from 'lucide-react';
import './Notification.css';

// --- API CONFIGURATION ---
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const apiFetch = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    const finalOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, finalOptions);

        if (!response.ok) {
            let errorDetails = `HTTP error! status: ${response.status}`;
            try {
                const errorBody = await response.json();
                if (errorBody.message) errorDetails = errorBody.message;
                else if (errorBody.error) errorDetails = errorBody.error;
            } catch (e) {
                // Ignore if response body is not JSON
            }
            throw new Error(`API Error: ${errorDetails}`);
        }

        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return {};
        }

        return await response.json();
    } catch (err) {
        console.error('API Fetch Error:', err);
        throw err;
    }
};

// API Methods
export const activityLogsAPI = {
    getAll: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/activity-logs?${queryString}` : '/activity-logs';
        return apiFetch(endpoint);
    },
    
    getByDateRange: (startDate, endDate) => {
        if (startDate && endDate) {
            return apiFetch(`/activity-logs?start_date=${startDate}&end_date=${endDate}`);
        }
        return activityLogsAPI.getAll();
    },
    
    // Additional API methods can be added here
    getByUser: (userId) => apiFetch(`/activity-logs/user/${userId}`),
    getByType: (type) => apiFetch(`/activity-logs?activity_type=${type}`),
};

// --- UTILITY FUNCTIONS ---
const timeAgo = (dateString) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return past.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

// --- COMPONENTS ---
const NotificationItem = React.memo(({ log, index }) => {
    const getIconConfig = useMemo(() => {
        const configs = {
            'task_assigned': { 
                Icon: Briefcase, 
                colorClass: 'text-indigo-600', 
                bgClass: 'bg-gradient-to-br from-indigo-100 to-indigo-50',
                gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)'
            },
            'project_update': { 
                Icon: CheckCircle, 
                colorClass: 'text-emerald-600', 
                bgClass: 'bg-gradient-to-br from-emerald-100 to-emerald-50',
                gradient: 'linear-gradient(135deg, #10b981, #059669)'
            },
            'comment': { 
                Icon: MessageSquare, 
                colorClass: 'text-sky-600', 
                bgClass: 'bg-gradient-to-br from-sky-100 to-sky-50',
                gradient: 'linear-gradient(135deg, #0ea5e9, #0369a1)'
            },
            'system_alert': { 
                Icon: AlertTriangle, 
                colorClass: 'text-red-600', 
                bgClass: 'bg-gradient-to-br from-red-100 to-red-50',
                gradient: 'linear-gradient(135deg, #ef4444, #dc2626)'
            },
        };
        
        return configs[log.type] || { 
            Icon: Bell, 
            colorClass: 'text-gray-600', 
            bgClass: 'bg-gradient-to-br from-gray-100 to-gray-50',
            gradient: 'linear-gradient(135deg, #6b7280, #4b5563)'
        };
    }, [log.type]);

    const { Icon, colorClass, bgClass } = getIconConfig;

    return (
        <div 
            className={`notification-item flex items-start ${log.isRead ? '' : 'unread'}`}
            style={{ '--item-index': index }}
            onClick={() => {
                // Handle notification click (e.g., mark as read)
                if (!log.isRead) {
                    // You would typically call an API here to mark as read
                    console.log('Marking notification as read:', log.id);
                }
            }}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!log.isRead) {
                        console.log('Marking notification as read:', log.id);
                    }
                }
            }}
        >
            <div className={`notification-icon ${bgClass}`}>
                <Icon size={24} className={colorClass} />
            </div>
            
            <div className="notification-content">
                <p className={`notification-message ${log.isRead ? '' : 'unread'}`}>
                    {log.message}
                </p>
                <div className="notification-time">
                    {timeAgo(log.timestamp)}
                    {log.projectNo && (
                        <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            Project: {log.projectNo}
                        </span>
                    )}
                </div>
            </div>

            {!log.isRead && (
                <div className="unread-dot ml-3" aria-label="Unread notification" />
            )}
        </div>
    );
});

NotificationItem.displayName = 'NotificationItem';

// --- MAIN APP COMPONENT ---
const App = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [unreadCount, setUnreadCount] = useState(0);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isDateSearchActive, setIsDateSearchActive] = useState(false);

    const fetchLogs = useCallback(async (start = '', end = '') => {
        setLoading(true);
        setError(null);
        try {
            let result;
            if (start && end) {
                result = await activityLogsAPI.getByDateRange(start, end);
                setIsDateSearchActive(true);
            } else {
                result = await activityLogsAPI.getAll();
                setIsDateSearchActive(false);
            }
            
            const data = result.data || result;
            
            if (!Array.isArray(data)) {
                throw new Error("Invalid response format: Expected an array of logs.");
            }

            // Sort by timestamp descending
            const sortedLogs = data.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            
            setLogs(sortedLogs);
            setUnreadCount(sortedLogs.filter(log => !log.isRead).length);
        } catch (err) {
            setError(`Failed to load activity logs: ${err.message}. Please check your API connection.`);
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleDateSearch = () => {
        if (startDate && endDate) {
            if (new Date(startDate) > new Date(endDate)) {
                setError('Start date cannot be after end date');
                return;
            }
            fetchLogs(startDate, endDate);
        } else {
            setError('Please select both start and end dates');
        }
    };


    const handleRefresh = () => {
        if (isDateSearchActive && startDate && endDate) {
            fetchLogs(startDate, endDate);
        } else {
            fetchLogs();
        }
    };

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
        fetchLogs();
    };

    const filteredLogs = useMemo(() => {
        let filtered = logs;
        if (filter === 'unread') {
            filtered = logs.filter(log => !log.isRead);
        }
        return filtered;
    }, [logs, filter]);

    return (
        <div className="notification-page">
            <div className="notification-container">
                {/* Header */}
                <div className="notification-header">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                        <div>
                            <h1 className="notification-title flex items-center">
                                <Bell className="w-8 h-8 mr-3" />
                                Activity Notifications
                            </h1>
                            <p className="text-blue-100 mt-2 opacity-90">
                                Stay updated with all your project activities
                            </p>
                        </div>
                        
                        {unreadCount > 0 && (
                            <div className="mt-4 sm:mt-0">
                                <span className="unread-count-badge inline-flex items-center">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Date Filter */}
                <div className="date-filter-container">
                    <div className="date-input-group">
                        <div className="date-input-wrapper">
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                                From Date
                            </label>
                            <input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="date-input"
                                max={endDate || undefined}
                            />
                        </div>
                        
                        <div className="date-input-wrapper">
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                                To Date
                            </label>
                            <input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="date-input"
                                min={startDate || undefined}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={handleDateSearch}
                            disabled={!startDate || !endDate}
                            className="date-search-btn"
                        >
                            <Search className="w-4 h-4" />
                            Search by Date
                        </button>
                        
                        {(startDate || endDate) && (
                            <button
                                onClick={handleClearDates}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Clear Dates
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="notification-card">
                    {/* Loading State */}
                    {loading && (
                        <div className="loading-container">
                            <div className="loading-spinner" />
                            <p className="loading-text">Loading your notifications...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                        <div className="error-container">
                            <div className="error-icon">
                                <AlertTriangle className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="error-title">Oops! Something went wrong</h3>
                            <p className="error-message">{error}</p>
                            <button
                                onClick={handleRefresh}
                                className="retry-button"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && filteredLogs.length === 0 && (
                        <div className="empty-container">
                            <div className="empty-icon">
                                <Bell className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="empty-title">
                                {filter === 'unread' ? 'No Unread Notifications' : 'All Caught Up!'}
                            </h3>
                            <p className="empty-message">
                                {isDateSearchActive
                                    ? `No notifications found for the selected date range.`
                                    : `You're all caught up! No ${filter === 'unread' ? 'unread ' : ''}notifications to display.`
                                }
                            </p>
                        </div>
                    )}

                    {/* Notification List */}
                    {!loading && !error && filteredLogs.length > 0 && (
                        <div className="notification-scroll-area">
                            <div role="list" aria-label="Notifications">
                                {filteredLogs.map((log, index) => (
                                    <NotificationItem 
                                        key={log.id || index} 
                                        log={log} 
                                        index={index}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Stats */}
                {!loading && !error && filteredLogs.length > 0 && (
                    <div className="mt-6 text-center text-sm text-gray-500">
                        <p>
                            Showing {filteredLogs.length} of {logs.length} notifications
                            {isDateSearchActive && ' (filtered by date)'}
                        </p>
                        <p className="mt-1">
                            Last updated: {new Date().toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;