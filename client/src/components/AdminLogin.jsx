import React, { useState } from 'react';
import { authenticateAdmin } from '../services/firebaseService';
import './AdminLogin.css';

function AdminLogin({ onLoginSuccess }) {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!mobile || !pin) {
      setError('Please enter both mobile number and PIN');
      setLoading(false);
      return;
    }

    const result = await authenticateAdmin(mobile, pin);

    if (result.success) {
      // Store admin info in localStorage
      localStorage.setItem('adminId', result.adminId);
      localStorage.setItem('adminEmail', result.adminData.email || `${mobile}@admin.local`);
      localStorage.setItem('adminMobile', mobile);
      onLoginSuccess({
        ...result.adminData,
        email: result.adminData.email || `${mobile}@admin.local`,
        id: result.adminId
      });
    } else {
      setError(result.error || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <h1 className="admin-login-title">Admin Login</h1>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="mobile">Mobile Number</label>
            <input
              type="tel"
              id="mobile"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                setError('');
              }}
              placeholder="Enter mobile number"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="pin">PIN</label>
            <input
              type="password"
              id="pin"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              placeholder="Enter PIN"
              required
              maxLength="6"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
