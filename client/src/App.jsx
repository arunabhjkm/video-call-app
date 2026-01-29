import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import VideoCall from './VideoCall';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import ThankYou from './components/ThankYou';

// Wrapper component to handle room/slot parameter
function VideoCallWrapper() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room') || searchParams.get('slot');
  
  return <VideoCall initialRoomId={roomId} />;
}

// Admin route wrapper
function AdminRoute() {
  const [adminData, setAdminData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if admin is already logged in
    const adminId = localStorage.getItem('adminId');
    const adminEmail = localStorage.getItem('adminEmail');
    
    if (adminId && adminEmail) {
      setAdminData({ email: adminEmail, id: adminId });
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (data) => {
    setAdminData(data);
    setIsAuthenticated(true);
  };

  if (loading) {
  return (
        <div style={{
          display: 'flex',
        justifyContent: 'center',
          alignItems: 'center',
        minHeight: '100vh',
        background: '#0f172a',
        color: '#e2e8f0'
        }}>
          <div className="spinner"></div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        <AdminDashboard adminData={adminData} />
      ) : (
        <AdminLogin onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VideoCallWrapper />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
