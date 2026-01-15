import React, { useState } from 'react';
import './LoginForm.css';

function LoginForm({ onLogin }) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [waitTime, setWaitTime] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setWaitTime(null);
    setLoading(true);

    try {
      await onLogin(apiKey);
    } catch (err) {
      setError(err.message || 'Login failed');
      
      // Check if it's a rate limit error
      if (err.waitTime) {
        setWaitTime(err.waitTime);
        let remaining = err.waitTime;
        const interval = setInterval(() => {
          remaining--;
          setWaitTime(remaining);
          if (remaining <= 0) {
            clearInterval(interval);
            setWaitTime(null);
          }
        }, 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form-container">
      <div className="login-form">
        <h2>Admin Login</h2>
        <p className="login-subtitle">Enter your Torn API key to access the admin panel</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="apiKey">Torn API Key</label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              required
              disabled={loading || waitTime}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
              {waitTime && (
                <div className="wait-time">
                  Please wait {waitTime} seconds before trying again.
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading || waitTime || !apiKey}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
