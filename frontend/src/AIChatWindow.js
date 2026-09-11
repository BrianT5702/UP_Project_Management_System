import React, { useState, useEffect, useCallback, useRef } from 'react';
import { aiAPI } from '../src/apiService';

const AIChatWindow = ({
  embedded = false,
  onClose,
  addNotification,
  fetchProjects,
  activeTab,
  createProject,
  uploadProjectFiles,
  onBulkCreateClick,
  onBulkUpdateClick,
}) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 I can manage projects.\n\n• **Type a command** like:\n  - `create project JOB-123 for ACME`\n  - `update project JOB-123 status to done`\n  - `delete project JOB-123`\n• **Batch actions**: use the buttons below to open the bulk create / update modals.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');

  const messagesEndRef = useRef(null);

  const [sessionId] = useState(() => {
    let stored = localStorage.getItem('ai_session_id');
    if (!stored) {
      stored = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      localStorage.setItem('ai_session_id', stored);
    }
    return stored;
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    const userMsg = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date().toLocaleTimeString() }]);

    setIsLoading(true);
    setStreamingMessage('');

    aiAPI.chatStream(
      userMsg,
      sessionId,
      (acc) => setStreamingMessage(acc),
      (fullMessage, isMutation) => {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: fullMessage,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        setStreamingMessage('');
        setIsLoading(false);
        if (isMutation) {
          addNotification('✅ Project list updated.');
          fetchProjects(activeTab);
        }
      },
      (error) => {
        console.error('AI stream error:', error);
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}`, timestamp: new Date().toLocaleTimeString() }]);
        setStreamingMessage('');
        setIsLoading(false);
      }
    );
  }, [inputValue, isLoading, sessionId, addNotification, fetchProjects, activeTab]);

  const quickActions = [
    { label: '📦 Create Project', action: onBulkCreateClick },
    { label: '✏️ Update Project', action: onBulkUpdateClick },
    { label: '✏️ Update status', text: 'Update project JOB-123 status to done' },
    { label: '🗑️ Delete project', text: 'Delete project JOB-123' },
    { label: '📊 Summary', text: 'How many projects are active?' },
  ];

  return (
    <div className={`ai-chat-panel ${embedded ? 'embedded' : 'overlay'}`}>
      <div className="ai-chat-header">
        <div className="ai-chat-header-info">
          <span className="ai-avatar">🤖</span>
          <div>
            <h3>AI Assistant</h3>
            <span style={{ fontSize: '0.7rem', color: '#aaa' }}>Session: {sessionId.slice(-6)}</span>
          </div>
        </div>
        <button className="ai-chat-close" onClick={onClose}>×</button>
      </div>

      <div className="ai-chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <div className="message-avatar">{msg.role === 'user' ? 'You' : 'AI'}</div>
            <div className="message-bubble">
              <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              {msg.timestamp && <div className="message-time">{msg.timestamp}</div>}
            </div>
          </div>
        ))}
        {streamingMessage && (
          <div className="chat-message assistant">
            <div className="message-avatar">AI</div>
            <div className="message-bubble">
              <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>{streamingMessage}</div>
              <div className="message-time">typing…</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="quick-actions-panel">
        <div className="quick-actions-title">⚡ Quick actions</div>
        <div className="quick-actions-buttons">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              className="quick-action-btn"
              onClick={() => action.action ? action.action() : setInputValue(action.text)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="quick-actions-note">💬 Streaming replies with conversation memory</div>
      </div>

      <div className="ai-chat-input-area">
        <input
          id="chat-input-field"
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a command…"
          disabled={isLoading}
        />
        <button onClick={handleSendMessage} disabled={isLoading}>
          {isLoading ? 'Thinking…' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default AIChatWindow;