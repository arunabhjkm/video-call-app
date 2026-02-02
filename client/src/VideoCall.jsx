import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import Video from './Video';
import './App.css';
import { checkMeetingExists, addParticipantToMeeting, removeParticipantFromMeeting, listenMeetingChanges, updateMeetingStatus } from './services/firebaseService';

// Polyfills handled by vite-plugin-node-polyfills

const SERVER_URL = 'https://video-call-app-4xz9.onrender.com';
const socket = io(SERVER_URL);

function VideoCall({ initialRoomId }) {
  const navigate = useNavigate();
  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [streamError, setStreamError] = useState(null);
  const [roomID, setRoomID] = useState(initialRoomId || '');
  const [joined, setJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [meetingStatus, setMeetingStatus] = useState('active');
  const [meetingEndsAt, setMeetingEndsAt] = useState(null);
  const [countdownText, setCountdownText] = useState('');
  const timerHandledRef = useRef(false);

  // Controls State
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  // Map peerID -> { mic: bool, camera: bool }
  const [peerStates, setPeerStates] = useState({});
  // Map peerID -> name
  const [peerNames, setPeerNames] = useState({});
  const [fakeLoginError, setFakeLoginError] = useState('');

  const myVideo = useRef();
  const previewVideo = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();

  const [searchParams] = useSearchParams();
  const slotParam = searchParams.get('s') || searchParams.get('slot');
  const nameParam = searchParams.get('n') || searchParams.get('name') || 'Guest';

  useEffect(() => {
    // Ensure socket is connected
    if (!socket.connected) {
      socket.connect();
    }

    // Socket connection listeners
    socket.on('connect', () => {
      const msg = `Socket Connected: ${socket.id}`;
      console.log(msg);
    });

    socket.on('connect_error', (err) => {
      const msg = `Socket Error: ${err.message}`;
      console.error(msg);
    });

    if (!slotParam) {
      // If no slot param, we show login page and DO NOT ask for camera
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStreamError("Camera access requires a secure connection (HTTPS) or use localhost. If you are on a different device, you must enable HTTPS.");
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        streamRef.current = currentStream;
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
        if (previewVideo.current) {
          previewVideo.current.srcObject = currentStream;
        }
      })
      .catch((err) => {
        console.error("Failed to get media stream:", err);
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          console.log("Retrying with video only...");
          navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then((currentStream) => {
              setStream(currentStream);
              streamRef.current = currentStream;
              if (myVideo.current) {
                myVideo.current.srcObject = currentStream;
              }
              if (previewVideo.current) {
                previewVideo.current.srcObject = currentStream;
              }
              setStreamError("Microphone not found. Video only mode.");
            })
            .catch((err2) => {
              console.error("Failed to get video only stream:", err2);
              setStreamError("Could not find any camera or microphone. Please check your devices.");
            });
        } else if (err.name === 'NotAllowedError') {
          setStreamError("Permission denied. Please allow camera and microphone access.");
        } else {
          setStreamError(`Camera error: ${err.message}`);
        }
      });

    socket.on("all users", users => {
      // Users is now array of {id, name}
      console.log("All users in room:", users);
      const peers = [];
      const names = {};

      users.forEach(user => {
        // Handle backward compatibility if user is just string ID
        const userID = user.id || user;
        const userName = user.name || 'Guest';

        const peer = createPeer(userID, socket.id, streamRef.current);
        peersRef.current.push({ peerID: userID, peer });
        peers.push({ peerID: userID, peer });
        names[userID] = userName;
      });

      setPeers(peers);
      setPeerNames(prev => ({ ...prev, ...names }));
      setIsJoining(false);
    });

    socket.on("user joined", payload => {
      console.log("Client received 'user joined' from:", payload.callerID);
      const peer = addPeer(payload.signal, payload.callerID, streamRef.current);
      peersRef.current.push({
        peerID: payload.callerID,
        peer,
      })
      setPeers(users => [...users, { peerID: payload.callerID, peer }]);
      if (payload.callerName) {
        setPeerNames(prev => ({ ...prev, [payload.callerID]: payload.callerName }));
      }
    });

    socket.on("receiving returned signal", payload => {
      const item = peersRef.current.find(p => p.peerID === payload.id);
      if (item) {
        item.peer.signal(payload.signal);
      }
    });

    socket.on("user left", id => {
      console.log("User left:", id);
      const peerObj = peersRef.current.find(p => p.peerID === id);
      if (peerObj) {
        peerObj.peer.destroy();
      }
      const peers = peersRef.current.filter(p => p.peerID !== id);
      peersRef.current = peers;
      setPeers(peers);
    });

    socket.on("status update", payload => {
      setPeerStates(prev => ({
        ...prev,
        [payload.id]: {
          ...prev[payload.id],
          [payload.type]: payload.status
        }
      }));
    });

    socket.on("room full", () => {
      alert("Room is full");
    });

    return () => {
      socket.off("all users");
      socket.off("user joined");
      socket.off("receiving returned signal");
      socket.off("user left");
      socket.off("room full");
      socket.off("status update");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      socket.disconnect(); // Ensure socket disconnects on unmount
    };
  }, []);

  // Monitor Network Quality
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return;

    const updateNetworkStatus = () => {
      const downlink = connection.downlink; // Mb/s
      // Consider low (< 1.5 Mbps) or if type is 'cellular' (2g/3g) though 'downlink' is better measure.
      // If downlink is small, we flag it.
      // 4g/wifi is usually good, but 'downlink' reflects actual bandwidth estimate.
      const isLow = downlink < 1.0;

      const status = isLow ? 'low' : 'good';
      socket.emit("update status", { type: "network", status: status });

      // Also update local visual if we want to see our own status? 
      // User requested "red network indicator on its screen", usually means on the user's video feed as seen by OTHERS.
      // But let's log it.
      console.log(`Network status changed: ${status} (Downlink: ${downlink})`);
    };

    connection.addEventListener('change', updateNetworkStatus);
    // updates not always frequent, so check once on mount
    updateNetworkStatus();

    return () => {
      connection.removeEventListener('change', updateNetworkStatus);
    };
  }, []);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("stream", stream => {
      peer.remoteStream = stream;
    });

    peer.on("signal", signal => {
      socket.emit("sending signal", { userToSignal, callerID, signal })
    })

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    })

    peer.on("stream", stream => {
      peer.remoteStream = stream;
    });

    peer.on("signal", signal => {
      socket.emit("returning signal", { signal, callerID })
    })

    peer.signal(incomingSignal);

    return peer;
  }

  // const [searchParams] = useSearchParams();
  // const slotParam = searchParams.get('s') || searchParams.get('slot');
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);

  const [socketJoined, setSocketJoined] = useState(false);

  // Auto-fill room ID from URL
  useEffect(() => {
    if (slotParam) {
      setRoomID(slotParam);
    }
  }, [slotParam]);

  // Handle Auto-Join when stream is ready
  useEffect(() => {
    if (slotParam && stream && !joined && !checkingSlot && !autoJoinAttempted) {
      setAutoJoinAttempted(true);
      joinRoom(slotParam);
    }
  }, [slotParam, stream, joined, checkingSlot, autoJoinAttempted]);

  // Handle Pending -> Active Transition
  useEffect(() => {
    if (joined && meetingStatus === 'active' && !socketJoined && roomID) {
      console.log("Meeting became active, joining socket room now...");

      // We must add participant to Firestore too, because joinRoom skipped it when status was pending
      if (socket.id) {
        addParticipantToMeeting(roomID, socket.id, nameParam)
          .then(() => console.log("Participant added to Firestore on active transition"))
          .catch(err => console.error("Failed to add participant on active transition", err));
      }

      socket.emit("join room", { roomID, name: nameParam });
      setSocketJoined(true);
    }
  }, [joined, meetingStatus, socketJoined, roomID]);


  const joinRoom = async (idToJoin = roomID) => {
    if (!idToJoin) {
      setSlotError('Please enter a slot ID');
      return;
    }

    if (!stream) {
      alert("Waiting for camera access...");
      return;
    }

    if (!socket.id) {
      console.log("Socket ID not ready, waiting...");
      setTimeout(() => joinRoom(idToJoin), 500);
      return;
    }

    setCheckingSlot(true);
    setSlotError('');

    // Check if slot ID exists in Firestore
    const checkResult = await checkMeetingExists(idToJoin);

    if (!checkResult.exists) {
      setCheckingSlot(false);
      const errorMsg = checkResult.error || 'Meeting not found. Please check and try again.';
      setSlotError(errorMsg);
      alert(errorMsg); // Show alert modal as requested
      return;
    }

    const meetingStatus = checkResult.status || checkResult.meetingData?.status || 'pending';

    // Check meeting status
    if (meetingStatus === 'pending') {
      setCheckingSlot(false);
      // We allow joining the "view" but show the pending snackbar
      setMeetingStatus('pending');
      setJoined(true);
      // We do NOT emit "join room" yet if we want to wait, or we emit it and the server handles it.
      // Assuming we just want to show the self-view and the waiting message:
      return;
    }

    if (meetingStatus === 'success') {
      setCheckingSlot(false);
      cleanupAndGoThankYou(); // Directly go to thank you logic
      return;
    }

    // Only allow join if status is 'active'
    if (meetingStatus !== 'active') {
      setCheckingSlot(false);
      const errorMsg = 'This meeting is not available.';
      setSlotError(errorMsg);
      alert(errorMsg); // Show alert modal as requested
      return;
    }

    // Store initial status/timer
    const meetingData = checkResult.meetingData || {};
    setMeetingStatus(meetingStatus);
    if (meetingData.endsAt) {
      const ends = meetingData.endsAt.toDate ? meetingData.endsAt.toDate() : new Date(meetingData.endsAt);
      setMeetingEndsAt(ends);
    } else {
      setMeetingEndsAt(null);
    }

    // Add participant to meeting
    await addParticipantToMeeting(idToJoin, socket.id, nameParam);

    // Join the room
    setIsJoining(true);
    socket.emit("join room", { roomID: idToJoin, name: nameParam });
    setJoined(true);
    setSocketJoined(true);
    setCheckingSlot(false);
    setTimeout(() => setIsJoining(false), 2000);
  }

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
        socket.emit("update status", { type: "mic", status: audioTrack.enabled });
      }
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOn(videoTrack.enabled);
        socket.emit("update status", { type: "camera", status: videoTrack.enabled });
      }
    }
  };

  const cleanupAndGoThankYou = async () => {
    try {
      // Remove self from Firestore participants list
      if (roomID && socket.id) {
        // User requested to remove regardless of tab open/close, so we MUST await this
        try {
          await removeParticipantFromMeeting(roomID, socket.id);
        } catch (err) {
          console.error("Failed to remove participant", err);
        }
      }

      // stop local media
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // destroy peers
      peersRef.current.forEach(p => {
        try { p.peer.destroy(); } catch { /* noop */ }
      });
      peersRef.current = [];
      setPeers([]);
    } finally {
      setJoined(false);
      navigate('/thank-you', { replace: true, state: { roomID, name: nameParam } });
    }
  };

  // Cleanup on unmount / refresh (best effort)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomID && socket.id && joined) {
        // Using sendBeacon or similar would be better, but keep simple first
        // We can't use async here reliably for Firestore, but we can try
        // Actually, for unload, it's tricky.
        // Let's at least handle the component unmount cleanup
      }
    };

    // We can rely on the return function of useEffect
    return () => {
      if (roomID && socket.id && joined) {
        removeParticipantFromMeeting(roomID, socket.id).catch(err => console.error("Cleanup error", err));
      }
    };
  }, [roomID, joined]);

  // End-call button uses this
  const disconnect = () => {
    cleanupAndGoThankYou();
  };

  const getGridLayout = (count) => {
    if (count <= 1) return { cols: 1, layout: 'single' };
    if (count === 2) return { cols: 2, layout: 'two' };
    if (count >= 3 && count <= 4) return { cols: 2, layout: 'four' };
    if (count >= 5 && count <= 6) return { cols: 3, layout: 'six' };
    if (count >= 7 && count <= 9) return { cols: 3, layout: 'nine' };
    return { cols: 4, layout: 'many' };
  };

  const formatTimeLeft = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Listen to meeting updates (status/timer)
  useEffect(() => {
    if (!joined || !roomID) return;
    const unsubscribe = listenMeetingChanges(roomID, (payload) => {
      if (payload.exists && payload.data) {
        const data = payload.data;
        const newStatus = data.status || 'active';
        setMeetingStatus(newStatus);

        // If status changes to 'success', send user to Thank You page
        if (newStatus === 'success') {
          cleanupAndGoThankYou();
          return;
        }

        if (data.endsAt) {
          const ends = data.endsAt.toDate ? data.endsAt.toDate() : new Date(data.endsAt);
          setMeetingEndsAt(ends);
        } else {
          setMeetingEndsAt(null);
        }
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [joined, roomID, meetingStatus]);

  // Countdown timer, auto-set status=success when timer ends, then redirect users
  useEffect(() => {
    let interval;
    const updateCountdown = () => {
      if (!meetingEndsAt) {
        setCountdownText('');
        timerHandledRef.current = false;
        return;
      }
      const now = new Date();
      const diff = meetingEndsAt - now;
      if (diff <= 0) {
        setCountdownText('0:00');
        if (joined && meetingStatus === 'active' && !timerHandledRef.current) {
          timerHandledRef.current = true;
          // Auto-change meeting status to success once timer ends
          updateMeetingStatus(roomID, 'success');
          cleanupAndGoThankYou();
        }
      } else {
        setCountdownText(formatTimeLeft(diff));
      }
    };
    updateCountdown();
    if (meetingEndsAt) {
      interval = setInterval(updateCountdown, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [meetingEndsAt, joined, meetingStatus, roomID]);

  const totalUsers = peers.length + 1;
  const grid = getGridLayout(totalUsers);

  // Prevent body scroll when in call
  useEffect(() => {
    if (joined) {
      document.body.classList.add('in-call');
    } else {
      document.body.classList.remove('in-call');
    }
    return () => {
      document.body.classList.remove('in-call');
    };
  }, [joined]);

  // Attach stream to myVideo when joined
  useEffect(() => {
    if (joined && stream && myVideo.current) {
      myVideo.current.srcObject = stream;
    }
  }, [joined, stream]);

  return (
    <div className={`container ${joined ? 'in-call' : ''}`}>
      {!joined && !slotParam && (
        <div className="join-page-wrapper">
          <div className="animated-shape shape-1"></div>
          <div className="animated-shape shape-2"></div>
          <div className="animated-shape shape-3"></div>
          <div className="join-page-content" style={{ flexDirection: 'column', gap: '20px' }}>
            <h1 className="join-page-title">Login</h1>

            <div className="join-container" style={{ flexDirection: 'column', gap: '15px' }}>
              <input
                type="text"
                placeholder="Username"
                style={{ marginBottom: '0' }}
                onChange={() => setFakeLoginError('')}
              />
              <input
                type="password"
                placeholder="Password"
                style={{ marginBottom: '0' }}
                onChange={() => setFakeLoginError('')}
              />

              {fakeLoginError && <div className="error-message" style={{ color: 'red', marginTop: '0', fontSize: '14px' }}>{fakeLoginError}</div>}

              <button onClick={() => setFakeLoginError('Invalid credentials')} style={{ marginTop: '5px' }}>
                Login
              </button>
            </div>
          </div>
        </div>
      )}

      {(isJoining || checkingSlot || (!joined && slotParam)) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="spinner"></div>
          <p style={{ color: 'white', marginTop: '20px', fontSize: '18px' }}>
            {checkingSlot
              ? (slotError === 'Meeting will begin soon...' ? 'Meeting will begin soon...' : 'Verifying slot ID...')
              : (!stream ? 'Requesting camera access...' : 'Joining room...')}
          </p>
        </div>
      )}

      {slotParam && streamError && <div className="error-message" style={{ color: 'red', margin: '10px' }}>{streamError}</div>}

      {joined && meetingStatus === 'success' && (
        <div className="error-message" style={{ margin: '10px', textAlign: 'center' }}>
          This meeting has ended.
        </div>
      )}

      {joined && countdownText && meetingStatus === 'active' && (
        <div className="error-message" style={{ margin: '10px', textAlign: 'center', background: 'rgba(250, 204, 21, 0.12)', color: '#fef08a' }}>
          Meeting is about to end in {countdownText}
        </div>
      )}

      {joined && (
        <div
          className={`video-container layout-${grid.layout}`}
          data-user-count={totalUsers}
          style={{ '--grid-cols': grid.cols }}
        >
          <div className="video-wrapper">
            <video playsInline muted ref={myVideo} autoPlay />
            <div className="user-label">{nameParam || 'You'}</div>
            <div className="status-icons">
              {!micOn && <span className="icon" title="Microphone muted">🔇</span>}
              {!cameraOn && <span className="icon" title="Camera off">📹</span>}
            </div>
          </div>
          {peers.map((peer) => {
            const status = peerStates[peer.peerID] || {};
            const isMicOn = status.mic !== undefined ? status.mic : true;
            const isCamOn = status.camera !== undefined ? status.camera : true;
            const peerName = peerNames[peer.peerID] || `User ${peer.peerID.slice(0, 4)}`;

            return (
              <div className="video-wrapper remote-video" key={peer.peerID}>
                <Video peer={peer.peer} />
                <div className="user-label">{peerName}</div>
                <div className="status-icons">
                  {!isMicOn && <span className="icon" title="Microphone muted">🔇</span>}
                  {!isCamOn && <span className="icon" title="Camera off">📹</span>}
                  {status.network === 'low' && <span className="network-indicator" title="Low Connectivity">⚠️ Low Network</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending Status Snackbar */}
      {joined && meetingStatus === 'pending' && (
        <div className="snackbar">
          <div className="snackbar-icon">
            <div className="snackbar-spinner"></div>
          </div>
          <div className="snackbar-message">Meeting will begin soon</div>
        </div>
      )}

      {joined && (
        <div className="controls-bar">
          <button className={`control-btn ${!micOn ? 'off' : ''}`} onClick={toggleMic} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}>
            {micOn ? '🎤' : '🔇'}
          </button>
          <button className={`control-btn ${!cameraOn ? 'off' : ''}`} onClick={toggleCamera} aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}>
            {cameraOn ? '📹' : '📷'}
          </button>
          <button className="control-btn end-call" onClick={disconnect} aria-label="End call">
            📞
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoCall;
