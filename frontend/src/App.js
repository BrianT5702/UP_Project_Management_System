// App.js
import React, { useState, useEffect } from 'react';
import DashboardApp from './DashboardPage';
import './LoginPage.css';

// =========================================================
// API Service (minimal – only auth)
// =========================================================
const API_BASE = 'http://localhost:5000/api';

const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!response.ok) {
      // Attempt to parse error message from response body
      let errorMsg = `API error: ${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        if (body.error) errorMsg = body.error;
      } catch (_) {}
      throw new Error(errorMsg);
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
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [position, setPosition] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setSuccessMessage('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setPosition('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    // Validation
    if (isSignUp) {
      if (!username || !password || !position) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }
    } else {
      if (!username || !password) {
        setError('Username and password are required');
        setIsLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        // Registration – do NOT auto-login
        await authAPI.register({ username, password, position });
        setSuccessMessage(
          'Registration successful! Your account is pending approval. '
        );
        // Switch back to login mode
        setIsSignUp(false);
        setPassword('');
        setConfirmPassword('');
        setPosition('');
        setUsername(''); // optional: clear username too
        // Stay on the login page
      } else {
        // Login – only succeeds if status === 'active'
        const response = await authAPI.login({ username, password });
        // Login successful – call the parent callback
        if (typeof onLogin === 'function') {
          onLogin(response.user, response.token, remember);
        } else {
          setError('Login callback is not configured correctly.');
        }
      }
    } catch (err) {
      // Display the error message from the backend (e.g., "pending approval" or "rejected")
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-brand">
            <h1>UnitedPanel</h1>
            <p>Project Management System</p>
          </div>

          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#333' }}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

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
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>
            {isSignUp && (
              <>
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
              </>
            )}
            {error && <div className="login-error">{error}</div>}
            {successMessage && <div className="login-success">{successMessage}</div>}
            <button
              type="submit"
              className="btn-primary login-btn"
              disabled={isLoading}
              style={{ width: '100%' }}
            >
              {isLoading ? 'Processing…' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          <div className="login-footer">
            <span>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button type="button" className="toggle-auth-btn" onClick={toggleMode} disabled={isLoading}>
                {isSignUp ? ' Sign In' : ' Sign Up'}
              </button>
            </span>
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
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Restore session
  useEffect(() => {
    const stored = localStorage.getItem('unitedpanel_session') || sessionStorage.getItem('unitedpanel_session');
    if (stored) {
      try {
        const { user, token } = JSON.parse(stored);
        setIsAuthenticated(true);
        setUser(user);
        setToken(token);
      } catch {
        localStorage.removeItem('unitedpanel_session');
        sessionStorage.removeItem('unitedpanel_session');
      }
    }
  }, []);

  const handleLogin = (userData, jwtToken, remember) => {
    setIsAuthenticated(true);
    setUser(userData);
    setToken(jwtToken);
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
    setUser(null);
    setToken(null);
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