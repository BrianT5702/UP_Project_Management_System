// App.js
import React, { useState, useEffect } from 'react';
import DashboardApp from './DashboardPage';
import './LoginPage.css';

// =========================================================
// API Service (minimal – only auth)
// =========================================================
const API_BASE = '/api';

const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!response.ok) {
      // Attempt to parse error message from response body
      let errorMsg = `API error: ${response.status} ${response.statusText}`;
      let errorCode;
      try {
        const body = await response.json();
        if (body.error) errorMsg = body.error;
        errorCode = body.code;
      } catch (_) {}
      const err = new Error(errorMsg);
      if (errorCode) err.code = errorCode;
      throw err;
    }
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

const authAPI = {
  login: (creds) => apiCall('/auth/login', { method: 'POST', body: JSON.stringify(creds) }),
  register: (userData) => apiCall('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  requestPasswordReset: (payload) => apiCall('/auth/password-reset/request', { method: 'POST', body: JSON.stringify(payload) }),
};

// =========================================================
// Simple Router (hash-based)
// =========================================================
const useSimpleRouter = () => {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/');
  const handleHashChange = () => setPath(window.location.hash.slice(1) || '/');
  useEffect(() => {
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const navigate = (newPath) => { window.location.hash = newPath; };
  return { navigate, currentRoute: path === '/login' ? 'Login' : 'Dashboard' };
};

// =========================================================
// Login Form (with Approval Flow)
// =========================================================
const LoginForm = ({ onLogin }) => {
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSignUp = mode === 'signup';
  const isReset = mode === 'reset';

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
    setPosition('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      if (isReset) {
        if (!username || !password) {
          setError('Username and new password are required');
          return;
        }
        if (password.length < 8) {
          setError('New password must be at least 8 characters');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        await authAPI.requestPasswordReset({ username, newPassword: password });
        setSuccessMessage('Reset submitted. Two superadmins must approve it before you can sign in with the new password.');
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
        return;
      }

      if (isSignUp) {
        if (!username || !password || !position) {
          setError('Please fill in all fields');
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        await authAPI.register({ username, password, position });
        setSuccessMessage('Registration successful. Two superadmins must approve your account before you can sign in.');
        setPassword('');
        setConfirmPassword('');
        setPosition('');
        setUsername('');
        setMode('signin');
        return;
      }

      if (!username || !password) {
        setError('Username and password are required');
        return;
      }

      const response = await authAPI.login({ username, password });
      if (typeof onLogin === 'function') {
        onLogin(response.user, response.token, false);
      } else {
        setError('Login callback is not configured correctly.');
      }
    } catch (err) {
      if (err.code === 'MUST_RESET') {
        setMode('reset');
        setPassword('');
        setConfirmPassword('');
      }
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const heading = isReset ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In';
  const submitLabel = isLoading ? 'Processing…' : isReset ? 'Submit reset' : isSignUp ? 'Sign Up' : 'Sign In';

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-brand">
            <h1>UnitedPanel</h1>
            <p>Project Management System</p>
          </div>

          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#333' }}>
            {heading}
          </h2>

          {isReset && (
            <p className="login-reset-hint">
              Enter a new password. Two superadmins must acknowledge and approve the reset before it takes effect.
            </p>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoFocus
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label>{isReset ? 'New password' : 'Password'}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isReset ? 'Enter a new password' : 'Enter your password'}
                required
                disabled={isLoading}
              />
            </div>
            {(isSignUp || isReset) && (
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  disabled={isLoading}
                />
              </div>
            )}
            {isSignUp && (
              <div className="form-group">
                <label>Position</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  required
                  disabled={isLoading}
                  className="form-select"
                >
                  <option value="">Select position</option>
                  <option value="admin">Admin</option>
                  <option value="panel manager">Panel Manager</option>
                  <option value="sale">Sale</option>
                  <option value="cut">Cut</option>
                  <option value="door">Door</option>
                  <option value="accessories">Accessories</option>
                  <option value="system">System</option>
                  <option value="transportation">Transportation</option>
                  <option value="panel">Panel</option>
                </select>
              </div>
            )}
            {error && <div className="login-error">{error}</div>}
            {successMessage && <div className="login-success">{successMessage}</div>}
            <button
              type="submit"
              className="btn-primary login-btn"
              disabled={isLoading}
              style={{ width: '100%' }}
            >
              {submitLabel}
            </button>
          </form>
          <div className="login-footer">
            {!isSignUp && !isReset && (
              <button type="button" className="forgot-link-btn" onClick={() => switchMode('reset')} disabled={isLoading}>
                Forgot password?
              </button>
            )}
            {isReset ? (
              <span>
                Remembered your password?
                <button type="button" className="toggle-auth-btn" onClick={() => switchMode('signin')} disabled={isLoading}>
                  {' '}Sign In
                </button>
              </span>
            ) : (
              <span>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                <button type="button" className="toggle-auth-btn" onClick={() => switchMode(isSignUp ? 'signin' : 'signup')} disabled={isLoading}>
                  {isSignUp ? ' Sign In' : ' Sign Up'}
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================
// Main App
// =========================================================
function App() {
  const { navigate, currentRoute } = useSimpleRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Restore session
  useEffect(() => {
    const stored = localStorage.getItem('unitedpanel_session') || sessionStorage.getItem('unitedpanel_session');
    if (stored) {
      try {
        JSON.parse(stored);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('unitedpanel_session');
        sessionStorage.removeItem('unitedpanel_session');
      }
    }
  }, []);

  const handleLogin = (userData, jwtToken, remember) => {
    setIsAuthenticated(true);
    const session = { user: userData, token: jwtToken };
    if (remember) {
      localStorage.setItem('unitedpanel_session', JSON.stringify(session));
    } else {
      sessionStorage.setItem('unitedpanel_session', JSON.stringify(session));
    }
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('unitedpanel_session');
    sessionStorage.removeItem('unitedpanel_session');
    navigate('/login');
  };

  // Route protection
  useEffect(() => {
    if (!isAuthenticated && currentRoute !== 'Login') {
      navigate('/login');
    }
    if (isAuthenticated && currentRoute === 'Login') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, currentRoute, navigate]);

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return <DashboardApp navigate={navigate} currentRoute={currentRoute} onLogout={handleLogout} />;
}

export default App;