import React, { useEffect, useRef, useState } from 'react';
import './Video.css'; // We'll need to create this

const Video = ({ peer, stream, name, cameraOn, isLocal, muted }) => {
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
        </div>
    );
}

export default Video;
