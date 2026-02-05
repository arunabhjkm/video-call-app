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
  const typeParam = searchParams.get('t') || searchParams.get('type') || 'client'; // 'c' or 'l' or full string

  const getUserTypeIcon = (typeString) => {
    if (!typeString) return '👤';
    const t = typeString.toLowerCase();
    if (t === 'l' || t === 'lawyer') return '🧑‍⚖️';
    return '👤';
  };

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
      })
      .catch((err) => {
        console.error("Failed to get media stream:", err);
        // Allow joining without media
        setStreamError("Camera/Mic access denied or not found. You can still join as listener.");
        setMicOn(false);
        setCameraOn(false);
        // We set stream to null, but SimplePeer might need a stream to initiate 'stream' event on other side?
        // Actually we can add stream later, or just init peer without stream.
        // But for this app, we proceed. 
      });

    socket.on("all users", users => {
      // Users is now array of {id, name, type}
      console.log("All users in room:", users);
      const peers = [];
      const names = {};
      const newPeerStates = {};
      const types = {};

      users.forEach(user => {
        const userID = user.id || user;
        const userName = user.name || 'Guest';
        const userType = user.type || 'client';

        const peer = createPeer(userID, socket.id, streamRef.current);
        peersRef.current.push({ peerID: userID, peer });
        peers.push({ peerID: userID, peer });
        names[userID] = userName;
        types[userID] = userType;
      });

      setPeers(peers);
      setPeerNames(prev => ({ ...prev, ...names }));
      setPeerTypes(prev => ({ ...prev, ...types }));
      setIsJoining(false);
    });

    // ... (rest of socket events) ...

    const joinRoom = async (idToJoin = roomID) => {
      if (!idToJoin) {
        setSlotError('Please enter a slot ID');
        return;
      }

      // REMOVED check for !stream to allow joining without it
      // if (!stream) { ... }

      if (!socket.id) {
        // ...
      }

      // ... (rest of join logic) ...

      // Join the room
      setIsJoining(true);
      socket.emit("join room", { roomID: idToJoin, name: nameParam, type: typeParam });
      setJoined(true);
      setSocketJoined(true);
      setCheckingSlot(false);
      setTimeout(() => setIsJoining(false), 2000);
    }

    // ...

    {
      joined && (
        <div
          className={`video-container layout-${grid.layout}`}
          data-user-count={totalUsers}
          style={{ '--grid-cols': grid.cols }}
        >
          <div className="video-wrapper">
            <Video
              stream={stream}
              muted={true}
              isLocal={true}
              name={nameParam}
              cameraOn={cameraOn}
            />
            <div className="user-label">{getUserTypeIcon(typeParam)} {nameParam || 'You'}</div>
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
            const peerType = peerTypes[peer.peerID] || 'client'; // default for remote

            return (
              <div className="video-wrapper remote-video" key={peer.peerID}>
                <Video
                  peer={peer.peer}
                  name={peerName}
                  cameraOn={isCamOn}
                />
                <div className="user-label">{getUserTypeIcon(peerType)} {peerName}</div>
                <div className="status-icons">
                  {!isMicOn && <span className="icon" title="Microphone muted">🔇</span>}
                  {!isCamOn && <span className="icon" title="Camera off">📹</span>}
                  {status.network === 'low' && <span className="network-indicator" title="Low Connectivity">⚠️ Low Network</span>}
                </div>
              </div>
            );
          })}
        </div>
      )
    }

    {/* Pending Status Snackbar */ }
    {
      joined && meetingStatus === 'pending' && (
        <div className="snackbar">
          <div className="snackbar-icon">
            <div className="snackbar-spinner"></div>
          </div>
          <div className="snackbar-message">Meeting will begin soon</div>
        </div>
      )
    }

    {
      joined && (
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
      )
    }
    </div >
  );
}

export default VideoCall;
