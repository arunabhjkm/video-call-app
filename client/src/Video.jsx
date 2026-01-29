import React, { useEffect, useRef } from 'react';

const Video = (props) => {
    const ref = useRef();

    useEffect(() => {
        const handleStream = (stream) => {
            if (ref.current) {
                ref.current.srcObject = stream;
                ref.current.play().catch(error => {
                    console.error("Video play failed:", error);
                });
            }
        };

        // Check if stream already exists (Race condition fix)
        if (props.peer.remoteStream) {
            handleStream(props.peer.remoteStream);
        }

        props.peer.on("stream", handleStream);

    }, []);

    return (
        <video
            playsInline
            autoPlay
            ref={ref}
        />
    );
}

export default Video;
