import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMeeting, getAdminMeetings, updateMeetingStatus, setMeetingTimer, listenAdminMeetings } from '../services/firebaseService';
import './AdminDashboard.css';

function AdminDashboard({ adminData }) {
  const navigate = useNavigate();
  const [slotId, setSlotId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  const [customMinutes, setCustomMinutes] = useState({});

  const adminEmail = localStorage.getItem('adminEmail') || adminData?.email || 'admin@example.com';

  useEffect(() => {
    // Initial one-time load (optional, mainly for fast first paint)
    let unsubscribe;
    (async () => {
      setLoadingMeetings(true);
      const result = await getAdminMeetings(adminEmail);
      if (result.success) {
        setMeetings(result.meetings);
      }
      setLoadingMeetings(false);

      // Real-time listener
      unsubscribe = listenAdminMeetings(adminEmail, (payload) => {
        if (payload.success) {
          setMeetings(payload.meetings);
        }
      });
    })();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [adminEmail]);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!slotId.trim()) {
      setError('Please enter a slot ID');
      setLoading(false);
      return;
    }

    const result = await createMeeting(slotId.trim(), adminEmail);

    if (result.success) {
      setSuccess(`Meeting created successfully! Slot ID: ${slotId}`);
      setSlotId('');
      await loadMeetings(); // Reload meetings list
    } else {
      setError(result.error || 'Failed to create meeting');
    }

    setLoading(false);
  };

  const handleJoinMeeting = (roomId) => {
    window.location.href = `/?room=${roomId}`;
  };

  const handleCopyLink = async (slotId) => {
    const meetingLink = `${window.location.origin}/?slot=${slotId}`;
    try {
      await navigator.clipboard.writeText(meetingLink);
      setSuccess(`Meeting link copied to clipboard!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = meetingLink;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setSuccess(`Meeting link copied to clipboard!`);
        setTimeout(() => setSuccess(''), 3000);
      } catch (fallbackErr) {
        setError('Failed to copy link. Please copy manually: ' + meetingLink);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleStatusChange = async (slotId, status) => {
    const result = await updateMeetingStatus(slotId, status);
    if (!result.success) {
      setError(result.error || 'Failed to update status');
    } else {
      setSuccess(`Status updated to ${status}`);
    }
  };

  const handleSetTimer = async (slotId, minutes) => {
    if (!minutes || minutes <= 0) {
      setError('Please enter a valid duration in minutes');
      return;
    }
    const result = await setMeetingTimer(slotId, minutes);
    if (!result.success) {
      setError(result.error || 'Failed to set timer');
    } else {
      setSuccess(`Timer set for ${minutes} minutes`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminMobile');
    navigate('/admin');
  };

  return (
    <div className="admin-dashboard-container">
      <div className="admin-dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-info">
          <span>{adminEmail}</span>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Meeting
        </button>
        <button
          className={`tab-button ${activeTab === 'join' ? 'active' : ''}`}
          onClick={() => setActiveTab('join')}
        >
          Join Meeting
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'create' && (
          <div className="create-meeting-section">
            <h2>Create New Meeting</h2>
            <form onSubmit={handleCreateMeeting} className="create-meeting-form">
              <div className="form-group">
                <label htmlFor="slotId">Slot ID</label>
                <input
                  type="text"
                  id="slotId"
                  value={slotId}
                  onChange={(e) => {
                    setSlotId(e.target.value);
                    setError('');
                    setSuccess('');
                  }}
                  placeholder="Enter unique slot ID"
                  required
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}
              <button type="submit" className="create-button" disabled={loading}>
                {loading ? 'Creating...' : 'Create Meeting'}
              </button>
            </form>

            <div className="meetings-list-section">
              <h3>Your Meetings</h3>
              {loadingMeetings ? (
                <div className="loading">Loading meetings...</div>
              ) : meetings.length === 0 ? (
                <div className="no-meetings">No meetings created yet</div>
              ) : (
                <div className="meetings-list">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="meeting-item">
                      <div className="meeting-info">
                        <div className="meeting-slot">Slot ID: <strong>{meeting.slotId}</strong></div>
                        <div className="meeting-status">
                          Status: <span className={`status-badge ${meeting.status}`}>{meeting.status}</span>
                        </div>
                        <div className="meeting-date">
                          Created: {meeting.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}
                        </div>
                        <div className="meeting-participants">
                          Participants: {meeting.participants?.length || 0}
                        </div>
                        <div className="meeting-date">
                          Ends at: {meeting.endsAt?.toDate?.()?.toLocaleString() || 'Not set'}
                        </div>
                      </div>
                      <div className="meeting-actions">
                        <div className="status-control">
                          <label>Status</label>
                          <select
                            value={meeting.status || 'pending'}
                            onChange={(e) => handleStatusChange(meeting.slotId, e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="success">Success</option>
                          </select>
                        </div>
                        <div className="timer-control">
                          <label>Set Timer</label>
                          <div className="timer-buttons">
                            <button type="button" onClick={() => handleSetTimer(meeting.slotId, 15)}>15m</button>
                            <button type="button" onClick={() => handleSetTimer(meeting.slotId, 30)}>30m</button>
                            <button type="button" onClick={() => handleSetTimer(meeting.slotId, 45)}>45m</button>
                          </div>
                          <div className="timer-custom">
                            <input
                              type="number"
                              min="1"
                              placeholder="Custom (min)"
                              value={customMinutes[meeting.slotId] || ''}
                              onChange={(e) => setCustomMinutes({
                                ...customMinutes,
                                [meeting.slotId]: e.target.value
                              })}
                            />
                            <button
                              type="button"
                              onClick={() => handleSetTimer(meeting.slotId, Number(customMinutes[meeting.slotId]))}
                              disabled={!customMinutes[meeting.slotId]}
                            >
                              Set
                            </button>
                          </div>
                        </div>
                        <div className="meeting-buttons">
                          <button
                            onClick={() => handleCopyLink(meeting.slotId)}
                            className="copy-link-button"
                            title="Copy meeting link"
                          >
                            📋 Copy Link
                          </button>
                          <button
                            onClick={() => handleJoinMeeting(meeting.slotId)}
                            className="join-meeting-button"
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'join' && (
          <div className="join-meeting-section">
            <h2>Join Existing Meeting</h2>
            <div className="join-form">
              <div className="form-group">
                <label htmlFor="joinSlotId">Slot ID</label>
                <input
                  type="text"
                  id="joinSlotId"
                  value={slotId}
                  onChange={(e) => setSlotId(e.target.value)}
                  placeholder="Enter slot ID to join"
                />
              </div>
              <button
                onClick={() => slotId && handleJoinMeeting(slotId)}
                className="join-button"
                disabled={!slotId.trim()}
              >
                Join Meeting
              </button>
            </div>

            <div className="meetings-list-section">
              <h3>Your Meetings</h3>
              {loadingMeetings ? (
                <div className="loading">Loading meetings...</div>
              ) : meetings.length === 0 ? (
                <div className="no-meetings">No meetings available</div>
              ) : (
                <div className="meetings-list">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="meeting-item">
                      <div className="meeting-info">
                        <div className="meeting-slot">Slot ID: <strong>{meeting.slotId}</strong></div>
                        <div className="meeting-status">
                          Status: <span className={`status-badge ${meeting.status}`}>{meeting.status}</span>
                        </div>
                      </div>
                      <div className="meeting-buttons">
                        <button
                          onClick={() => handleCopyLink(meeting.slotId)}
                          className="copy-link-button"
                          title="Copy meeting link"
                        >
                          📋 Copy Link
                        </button>
                        <button
                          onClick={() => handleJoinMeeting(meeting.slotId)}
                          className="join-meeting-button"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
