import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import Video from './Video';
import './App.css';
import { checkMeetingExists, addParticipantToMeeting, listenMeetingChanges, updateMeetingStatus } from './services/firebaseService';

// Polyfills handled by vite-plugin-node-polyfills

const SERVER_URL = 'https://video-chat-server-mrto.onrender.com';
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

  const myVideo = useRef();
  const previewVideo = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();

  useEffect(() => {
    // Socket connection listeners
    socket.on('connect', () => {
      const msg = `Socket Connected: ${socket.id}`;
      console.log(msg);
    });

    socket.on('connect_error', (err) => {
      const msg = `Socket Error: ${err.message}`;
      console.error(msg);
    });

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
      console.log("All users in room:", users);
      const peers = [];
      users.forEach(userID => {
        const peer = createPeer(userID, socket.id, streamRef.current);
        peersRef.current.push({ peerID: userID, peer });
        peers.push({ peerID: userID, peer });
      });
      setPeers(peers);
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
    });

    socket.on("receiving returned signal", payload => {
      const item = peersRef.current.find(p => p.peerID === payload.id);
      if (item) {
        item.peer.signal(payload.signal);
      }
    });

    socket.on("user left", id => {
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

  const joinRoom = async () => {
    if (!roomID) {
      setSlotError('Please enter a slot ID');
      return;
    }

    if (!stream) {
      alert("Waiting for camera access...");
      return;
    }

    setCheckingSlot(true);
    setSlotError('');

    // Check if slot ID exists in Firestore
    const checkResult = await checkMeetingExists(roomID);
    
    if (!checkResult.exists) {
      setCheckingSlot(false);
      setSlotError(checkResult.error || 'Invalid slot ID. Please check and try again.');
      return;
    }

    const meetingStatus = checkResult.status || checkResult.meetingData?.status || 'pending';
    
    // Check meeting status
    if (meetingStatus === 'pending') {
      setCheckingSlot(false);
      setSlotError('Please wait, the meeting will begin shortly.');
      return;
    }

    if (meetingStatus === 'success') {
      setCheckingSlot(false);
      setSlotError('This meeting has ended.');
      return;
    }

    // Only allow join if status is 'active'
    if (meetingStatus !== 'active') {
      setCheckingSlot(false);
      setSlotError('This meeting is not available.');
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
    await addParticipantToMeeting(roomID, socket.id);

    // Join the room
    setIsJoining(true);
    socket.emit("join room", roomID);
    setJoined(true);
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

  const cleanupAndGoThankYou = () => {
    try {
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
      navigate('/thank-you', { replace: true });
    }
  };

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

  return (
    <div className={`container ${joined ? 'in-call' : ''}`}>
      {!joined && (
        <div className="join-page-wrapper">
          <div className="animated-shape shape-1"></div>
          <div className="animated-shape shape-2"></div>
          <div className="animated-shape shape-3"></div>
          <div className="join-page-content">
            <h1 className="join-page-title">Group Video Chat</h1>
            <p className="join-page-subtitle">Enter your slot ID to join the meeting</p>
            <div className="join-container">
              <input
                type="text"
                placeholder="Enter Slot ID"
                value={roomID}
                onChange={e => {
                  setRoomID(e.target.value);
                  setSlotError('');
                }}
              />
              {slotError && <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>{slotError}</div>}
              <button onClick={joinRoom} disabled={checkingSlot}>
                {checkingSlot ? 'Checking...' : 'Join Room'}
              </button>
            </div>
            {stream && !joined && (
              <div className="camera-preview-wrapper">
                <div className="camera-preview">
                  <video playsInline muted ref={previewVideo} autoPlay />
                  <div className="preview-label">You</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(isJoining || checkingSlot) && (
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
            {checkingSlot ? 'Verifying slot ID...' : 'Joining room...'}
          </p>
        </div>
      )}

      {streamError && <div className="error-message" style={{ color: 'red', margin: '10px' }}>{streamError}</div>}

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

      <div
        className={`video-container layout-${grid.layout}`}
        data-user-count={totalUsers}
        style={{ '--grid-cols': grid.cols }}
      >
        <div className="video-wrapper">
          <video playsInline muted ref={myVideo} autoPlay />
          <div className="user-label">You</div>
          <div className="status-icons">
            {!micOn && <span className="icon" title="Microphone muted">🔇</span>}
            {!cameraOn && <span className="icon" title="Camera off">📹</span>}
          </div>
        </div>
        {peers.map((peer) => {
          const status = peerStates[peer.peerID] || {};
          const isMicOn = status.mic !== undefined ? status.mic : true;
          const isCamOn = status.camera !== undefined ? status.camera : true;

          return (
            <div className="video-wrapper remote-video" key={peer.peerID}>
              <Video peer={peer.peer} />
              <div className="user-label">User {peer.peerID.slice(0, 4)}</div>
              <div className="status-icons">
                {!isMicOn && <span className="icon" title="Microphone muted">🔇</span>}
                {!isCamOn && <span className="icon" title="Camera off">📹</span>}
              </div>
            </div>
          );
        })}
      </div>

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
