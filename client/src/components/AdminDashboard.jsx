import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMeeting, getAdminMeetings, updateMeetingStatus, setMeetingTimer, listenAdminMeetings } from '../services/firebaseService';
import { listenParticipantLogs } from '../services/loggingService';
import './AdminDashboard.css';

// ─── LiveClock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="modal-clock">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// ─── CopyLinkDropdown ─────────────────────────────────────────────────────────
function CopyLinkDropdown({ slotId, onCopy, variant = 'text' }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handle = (type) => {
    onCopy(slotId, type);
    setOpen(false);
  };

  const isIcon = variant === 'icon';

  return (
    <div className={`copy-dropdown-wrapper ${isIcon ? 'icon-variant' : ''} ${open ? 'open' : ''}`} ref={ref}>
      <button
        className={`copy-link-button copy-link-toggle ${isIcon ? 'icon-button' : ''}`}
        onClick={() => setOpen(o => !o)}
        type="button"
        title="Copy Joining Link"
      >
        {isIcon ? (
          <>📋<span className="dropdown-arrow">{open ? '▲' : '▼'}</span></>
        ) : (
          <>📋 Copy Joining Link&nbsp;<span className="dropdown-arrow">{open ? '▲' : '▼'}</span></>
        )}
      </button>
      {open && (
        <div className={`copy-dropdown-menu ${isIcon ? 'menu-right' : ''}`}>
          <button className="copy-dropdown-item" onClick={() => handle('c')}>
            <span className="copy-type-icon">👤</span>
            <span className="copy-item-text">
              <strong>Client Link</strong>
              <small>?s={slotId}&amp;t=c</small>
            </span>
          </button>
          <button className="copy-dropdown-item" onClick={() => handle('l')}>
            <span className="copy-type-icon">⚖️</span>
            <span className="copy-item-text">
              <strong>Lawyer Link</strong>
              <small>?s={slotId}&amp;t=l</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MeetingModal ─────────────────────────────────────────────────────────────
function MeetingModal({ meeting, onClose, customMinutes, setCustomMinutes, onSetTimer, onCopyLink, onJoinMeeting }) {
  // Initialise from persisted DB value so active button shows on re-open
  const [selectedTimer, setSelectedTimer] = useState(() => meeting?.timerMinutes || null);
  const [feedback, setFeedback] = useState('');
  const [logs, setLogs] = useState({});
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    if (meeting?.slotId) {
      const unsubscribe = listenParticipantLogs(meeting.slotId, (newLogs) => {
        setLogs(newLogs);
      });
      return () => unsubscribe();
    }
  }, [meeting?.slotId]);

  // Sync when real-time updates change timerMinutes from another source
  useEffect(() => {
    if (meeting?.timerMinutes) {
      setSelectedTimer(meeting.timerMinutes);
    }
  }, [meeting?.timerMinutes]);

  if (!meeting) return null;

  const handlePreset = async (minutes) => {
    setSelectedTimer(minutes);   // optimistic — DB confirm will match via useEffect
    setFeedback(`Timer set to ${minutes} min ✓`);
    const result = await onSetTimer(meeting.slotId, minutes);
    if (result?.success === false) {
      setFeedback('Failed to set timer');
    }
  };

  const handleCustomSet = async () => {
    const mins = Number(customMinutes[meeting.slotId]);
    if (!mins || mins <= 0) return;
    setSelectedTimer(null);
    setFeedback(`Timer set to ${mins} min ✓`);
    const result = await onSetTimer(meeting.slotId, mins);
    if (result?.success === false) {
      setFeedback('Failed to set timer');
    }
  };

  const participants = meeting.participants || [];


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-header-left">
            <h2>Edit Meeting</h2>
            <span className="modal-slot-id">{meeting.slotId}</span>
          </div>
          <div className="modal-header-right">
            <LiveClock />
            <button className="close-button" onClick={onClose}>&#x2715;</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="modal-body">

          {/* Timer section */}
          <div className="modal-section">
            <h3>Set Timer</h3>
            <div className="timer-control">
              <div className="timer-buttons">
                {[15, 30, 45].map(min => (
                  <button
                    key={min}
                    type="button"
                    className={`timer-preset-btn${selectedTimer === min ? ' active' : ''}`}
                    onClick={() => handlePreset(min)}
                  >
                    {min} min
                  </button>
                ))}
              </div>
              <div className="timer-custom">
                <input
                  type="number"
                  min="1"
                  placeholder="Custom (min)"
                  value={customMinutes[meeting.slotId] || ''}
                  onChange={e => setCustomMinutes({ ...customMinutes, [meeting.slotId]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={handleCustomSet}
                  disabled={!customMinutes[meeting.slotId]}
                >
                  Set
                </button>
              </div>
              {/* always rendered — reserves height to prevent layout shift */}
              <div className="timer-feedback" style={{ visibility: feedback ? 'visible' : 'hidden' }}>{feedback || ' '}</div>
            </div>
          </div>

          {/* Actions section */}
          <div className="modal-section">
            <h3>Actions</h3>
              {/* Copy link dropdown + Join in same row */}
              <div className="meeting-buttons">
                <CopyLinkDropdown slotId={meeting.slotId} onCopy={onCopyLink} />
                <button onClick={() => onJoinMeeting(meeting.slotId)} className="join-meeting-button">🎥 Join Meeting</button>
              </div>
          </div>

          {/* Info section */}
          <div className="modal-section">
            <h3>Info</h3>
            <div className="modal-info-grid">
              <div className="info-row">
                <span className="info-label">Created</span>
                <span className="info-value">{meeting.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Ends At</span>
                <span className="info-value">{meeting.endsAt?.toDate?.()?.toLocaleString() || 'Not set'}</span>
              </div>
            </div>
          </div>

          {/* Participants section */}
          <div className="modal-section">
            <h3>Participants <span className="participant-count">{participants.length}</span></h3>
            {participants.length > 0 ? (
              <ul className="participants-list">
                {participants.map((p, index) => {
                  const name = typeof p === 'string' ? 'Guest' : (p.name || 'Guest');
                  const id = typeof p === 'string' ? p : (p.id || '');
                  const shortId = id ? id.slice(0, 6) : '—';
                  return (
                    <li key={`${id}-${index}`} className="participant-item">
                      <span className="participant-avatar">{name.charAt(0).toUpperCase()}</span>
                      <span className="participant-name">{name}</span>
                      <span className="participant-id">#{shortId}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="no-participants">No participants yet</div>
            )}
          </div>

          {/* Diagnostics Section */}
          <div className="modal-section" style={{ gridColumn: 'span 2' }}>
            <div className="diagnostics-header-toggle" onClick={() => setShowDiagnostics(!showDiagnostics)}>
              <h3>Live Diagnostics 📡</h3>
              <span className={`diagnostics-toggle-icon ${showDiagnostics ? 'expanded' : ''}`}>▼</span>
            </div>
            
            <div className={`diagnostics-collapsible-content ${showDiagnostics ? 'expanded' : ''}`}>
              {Object.keys(logs).length > 0 ? (
                <div className="diagnostics-list">
                  {Object.entries(logs).map(([id, log]) => {
                    const name = log.name || 'Guest';
                    const isMicWorking = log.mediaStatus?.micWorking;
                    const micLevel = log.mediaStatus?.micLevel || 0;
                    const permissions = log.permissions || {};
                    const network = log.network || {};
                    const device = log.device || {};
                    
                    return (
                      <div key={id} className="diagnostic-card">
                        <div className="diagnostic-header">
                          <div className="diagnostic-user">
                            <span className="diagnostic-name">{name}</span>
                            <span className="diagnostic-type">{log.type}</span>
                          </div>
                          <span className={`diagnostic-status-tag ${log.status}`}>
                            {log.status === 'active' ? '● Live' : (log.status === 'joined' ? '● Joined' : log.status)}
                          </span>
                        </div>
                        
                        <div className="diagnostic-grid">
                          <div className="diagnostic-item">
                            <span className="diag-label">Device</span>
                            <span className="diag-value">
                              {device.browser} on {device.os} ({device.platform})
                            </span>
                          </div>
                          
                          <div className="diagnostic-item">
                            <span className="diag-label">Network</span>
                            <span className="diag-value">
                              <span className={network.quality === 'low' ? 'badge-red' : 'badge-green'}>
                                {network.quality === 'low' ? '⚠️ Low' : '✓ Good'}
                              </span>
                              <small style={{ marginLeft: '4px', opacity: 0.7 }}>({network.downlink} Mbps)</small>
                            </span>
                          </div>

                          <div className="diagnostic-item">
                            <span className="diag-label">Permissions</span>
                            <div className="diag-value">
                              <span title="Mic" className={permissions.mic === 'granted' ? 'badge-green' : 'badge-red'} style={{ marginRight: '10px' }}>
                                🎙️ {permissions.mic}
                              </span>
                              <span title="Camera" className={permissions.camera === 'granted' ? 'badge-green' : 'badge-red'}>
                                📷 {permissions.camera}
                              </span>
                            </div>
                          </div>

                          <div className="diagnostic-item">
                            <span className="diag-label">Real Mic Test</span>
                            <div className="diag-value">
                              <span className={isMicWorking ? 'badge-green' : 'badge-red'}>
                                {isMicWorking ? '🔊 Picking up sound' : '🔇 No sound detected'}
                              </span>
                            </div>
                            {isMicWorking && (
                              <div className="mic-level-bar">
                                <div className="mic-level-fill" style={{ width: `${Math.min(micLevel * 2.5, 100)}%` }}></div>
                              </div>
                            )}
                          </div>

                          {log.iceConnectionStates && Object.keys(log.iceConnectionStates).length > 0 && (
                            <div className="ice-states">
                              <span className="diag-label" style={{ marginBottom: '4px', display: 'block' }}>ICE Connection States</span>
                              {Object.entries(log.iceConnectionStates).map(([peerId, state]) => (
                                <div key={peerId} className="ice-peer-row">
                                  <span>Peer {peerId.slice(0,4)}:</span>
                                  <span className={`ice-peer-state ${state}`}>{state}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-participants">Waiting for diagnostic data... (User must be in the call)</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

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
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  
  // Search and Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const adminEmail = localStorage.getItem('adminEmail') || adminData?.email || 'admin@example.com';



  useEffect(() => {
    // Initial one-time load (optional, mainly for fast first paint)
    let unsubscribe;
    (async () => {
      setLoadingMeetings(true);
      const result = await getAdminMeetings(adminEmail);
      if (result.success) {
        const sorted = (result.meetings || []).sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setMeetings(sorted);
      }
      setLoadingMeetings(false);

      // Real-time listener
      unsubscribe = listenAdminMeetings(adminEmail, (payload) => {
        if (payload.success) {
          const sorted = (payload.meetings || []).sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA;
          });
          setMeetings(sorted);
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
      // await loadMeetings(); // Listener handles update
    } else {
      setError(result.error || 'Failed to create meeting');
    }

    setLoading(false);
  };

  const handleJoinMeeting = (roomId) => {
    window.location.href = `/?s=${roomId}&name=Admin`;
  };

  const handleCopyLink = async (slotId, type = 'c') => {
    const meetingLink = `${window.location.origin}/?s=${slotId}&t=${type}`;
    const label = type === 'l' ? 'Lawyer' : 'Client';
    try {
      await navigator.clipboard.writeText(meetingLink);
      setSuccess(`${label} link copied to clipboard!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = meetingLink;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setSuccess(`${label} link copied to clipboard!`);
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

  const handleSetTimer = useCallback(async (slotId, minutes) => {
    if (!minutes || minutes <= 0) return { success: false };
    const result = await setMeetingTimer(slotId, minutes);
    if (!result.success) {
      setError(result.error || 'Failed to set timer');
    } else {
      setSuccess(`Timer set for ${minutes} minutes`);
      setTimeout(() => setSuccess(''), 3000);
    }
    return result;
  }, []);

  // MeetingModal is now defined outside this component (above)

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
        <button
          className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          All Meetings
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
          </div>
        )}

        {activeTab === 'list' && (
          <div className="join-meeting-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>All Meetings</h2>
              <span className="participant-count" style={{ fontSize: '14px', padding: '4px 12px' }}>
                Total: {meetings.length}
              </span>
            </div>

            {/* Search Bar */}
            <div className="search-container">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by Slot ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to page 1 on search
                  }}
                />
              </div>
            </div>

            <div className="meetings-list-section" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
              {loadingMeetings ? (
                <div className="loading">Loading meetings...</div>
              ) : meetings.length === 0 ? (
                <div className="no-meetings">No meetings found</div>
              ) : (() => {
                // Filter and Paginate
                const filteredMeetings = meetings.filter(m => 
                  m.slotId?.toLowerCase().includes(searchQuery.toLowerCase())
                );
                
                const totalPages = Math.ceil(filteredMeetings.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const paginatedMeetings = filteredMeetings.slice(startIndex, startIndex + itemsPerPage);

                return (
                  <>
                    <div className="meetings-list">
                      {paginatedMeetings.length > 0 ? (
                        paginatedMeetings.map((meeting) => (
                          <div key={meeting.id} className="meeting-item">
                            <div className="meeting-info">
                              <div className="meeting-slot">Slot ID: <strong>{meeting.slotId}</strong></div>
                              <div className="meeting-status">
                                <span className={`status-badge ${meeting.status}`}>{meeting.status}</span>
                              </div>
                            </div>

                            <div className="meeting-actions">
                              <div className="status-control">
                                <select
                                  value={meeting.status || 'pending'}
                                  onChange={(e) => handleStatusChange(meeting.slotId, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="active">Active</option>
                                  <option value="success">Success</option>
                                </select>
                              </div>

                              <CopyLinkDropdown slotId={meeting.slotId} onCopy={handleCopyLink} variant="icon" />

                              <button
                                className="actions-button"
                                onClick={() => setSelectedMeeting(meeting)}
                                title="Edit Meeting"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="no-meetings">No meetings match your search</div>
                      )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="pagination-container">
                        <button 
                          className="pagination-button" 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          &lt;
                        </button>
                        
                        <span className="pagination-nav">
                          Page {currentPage} of {totalPages}
                        </span>

                        <button 
                          className="pagination-button" 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          &gt;
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {selectedMeeting && (
        <MeetingModal
          meeting={meetings.find(m => m.id === selectedMeeting.id) || selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          customMinutes={customMinutes}
          setCustomMinutes={setCustomMinutes}
          onSetTimer={handleSetTimer}
          onCopyLink={handleCopyLink}
          onJoinMeeting={handleJoinMeeting}
        />
      )}
    </div>
  );
}

export default AdminDashboard;
