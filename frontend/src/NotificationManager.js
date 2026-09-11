import React, { useState } from 'react';
import Notification from './Notification';
import './Notification.css'; 

// Helper function to generate a unique ID
let notificationId = 0;
const generateId = () => notificationId++;

function NotificationManager() {
    // State to hold all active notifications
    const [notifications, setNotifications] = useState([]);

    /**
     * Adds a new notification to the state and sets a timeout to close it.
     * @param {string} message - The content of the notification.
     * @param {number} duration - Time in ms before auto-closing (e.g., 4000).
     */
    const addNotification = (message, duration = 4000) => {
        const id = generateId();
        const newNotification = {
            id,
            message,
        };

        // Add the new notification to the array
        setNotifications(prev => [...prev, newNotification]);

        // Auto-close after duration
        setTimeout(() => {
            removeNotification(id);
        }, duration);
    };

    /**
     * Removes a notification by its ID.
     * @param {number} id - The unique ID of the notification to remove.
     */
    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // --- Demo UI ---
    return (
        <div>
            <h2>Notification Manager Demo</h2>
            <p>Click the buttons below to trigger notification displays:</p>
            
            {/* Buttons to trigger different types of messages */}
            <button 
                onClick={() => addNotification("File uploaded successfully! 🎉", 3000)}
                style={{marginRight: '10px', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px'}}
            >
                Trigger Success
            </button>
            <button 
                onClick={() => addNotification("Error: Project deletion failed. Server responded with 500.", 6000)}
                style={{padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px'}}
            >
                Trigger Error
            </button>
            <button 
                onClick={() => addNotification("A long message that forces wrapping to check layout.", 5000)}
                style={{marginLeft: '10px', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px'}}
            >
                Trigger Long Message
            </button>

            {/* The actual fixed container for all notifications */}
            <div className="notification-container">
                {notifications.map(n => (
                    <Notification 
                        key={n.id}
                        message={n.message}
                        // Pass the remove function as the onClose handler
                        onClose={() => removeNotification(n.id)} 
                    />
                ))}
            </div>
        </div>
    );
}

export default NotificationManager;