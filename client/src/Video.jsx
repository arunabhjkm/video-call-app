import React, { useEffect, useRef, useState } from 'react';
import './Video.css'; // We'll need to create this

const Video = ({ peer, stream, name, cameraOn, micOn, isLocal, muted, type, networkStatus }) => {
    const ref = useRef();
    const [volume, setVolume] = useState(0);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const animationRef = useRef(null);

    // Initial Stream Setup
    useEffect(() => {
        const handleStream = (s) => {
            if (ref.current) {
                ref.current.srcObject = s;
                // If local, we might want to mute to avoid echo, but 'muted' prop handles it
            }
            setupAudioAnalysis(s);
        };

        if (isLocal && stream) {
            handleStream(stream);
        } else if (peer) {
            if (peer.remoteStream) {
                handleStream(peer.remoteStream);
            }
            peer.on("stream", handleStream);
        }

        return () => {
            if (peer) {
                peer.off("stream", handleStream);
            }
            cleanupAudio();
        };
    }, [peer, stream, isLocal]);

    const cleanupAudio = () => {
        if (sourceRef.current) {
            sourceRef.current.disconnect();
        }
        if (audioContextRef.current) {
            if (audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        }
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
    };

    const setupAudioAnalysis = (stream) => {
        // Only setup if there are audio tracks
        if (!stream.getAudioTracks().length) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceRef.current = source;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const analyze = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                setVolume(average);
                animationRef.current = requestAnimationFrame(analyze);
            };
            analyze();
        } catch (err) {
            console.error("Audio analysis setup failed:", err);
        }
    };

    // Calculate pulse scale based on volume (0 to 255)
    // We only want to pulse if it's significant (> 10?)
    const pulseScale = volume > 10 ? 1 + (volume / 255) * 0.3 : 1;
    const pulseColor = volume > 10 ? `rgba(74, 222, 128, ${Math.min(volume / 100, 0.6)})` : 'transparent';
    const borderColor = volume > 10 ? '#4ade80' : 'transparent';

    const firstLetter = name ? name.charAt(0).toUpperCase() : '?';
    // If no stream is present at all, treat as camera off
    // If isLocal and !stream is passed, camera is effectively off
    const isVideoVisible = (isLocal ? stream : (peer && peer.remoteStream)) && cameraOn;

    return (
        <div className={`video-frame ${!isVideoVisible ? 'no-video' : ''}`} style={{
            boxShadow: `0 0 0 2px ${borderColor}, 0 0 20px ${pulseColor}`,
            transition: 'box-shadow 0.1s ease',
            transform: `scale(${volume > 30 ? 1.02 : 1})`,
        }}>
            <video
                playsInline
                autoPlay
                muted={muted} // Muted for local, or if specified
                ref={ref}
                style={{ opacity: isVideoVisible ? 1 : 0 }}
            />

            {!isVideoVisible && (
                <div className="avatar-container">
                    <div className="avatar-circle" style={{
                        transform: `scale(${pulseScale})`,
                        boxShadow: `0 0 30px ${pulseColor}`
                    }}>
                        {firstLetter}
                    </div>
                </div>
            )}

            {/* User Label Integrated */}
            <div className="user-label-unified">
                <span className="user-type-icon">
                    {type === 'lawyer' || type === 'l' ? '🧑‍⚖️' : '👤'}
                </span>
                <span className="user-name-text">
                    {isLocal ? 'You' : (name || 'User')}
                </span>
            </div>

            {/* Status Icons Integrated */}
            <div className="status-icons-unified">
                {/* We only show "muted" icon if mic is off. camera status is obvious by avatar */}
                {/* For consistency with the request, let's show them if off */}
                {!cameraOn && (
                    <div className="status-icon cam-off" title="Camera off">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"></path><line x1="1" y1="1" x2="23" y2="23"></line><path d="m21 21-4.34-4.34"></path><path d="M21 7v10.34"></path></svg>
                    </div>
                )}
                {!micOn && (
                    <div className="status-icon mic-off" title="Microphone muted">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </div>
                )}
                {networkStatus === 'low' && (
                    <div className="status-icon network-low" title="Low Network">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 20h22L12 2Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Video;
