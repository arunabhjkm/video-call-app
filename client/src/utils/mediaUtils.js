/**
 * Detects browser, OS, and platform information from the user agent.
 */
export const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    let os = "Unknown";
    let isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

    if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";
    else if (ua.indexOf("Edge") > -1) browser = "Edge";
    else if (ua.indexOf("MSIE") > -1 || !!document.documentMode) browser = "IE";

    if (ua.indexOf("Win") > -1) os = "Windows";
    else if (ua.indexOf("Mac") > -1) os = "MacOS";
    else if (ua.indexOf("X11") > -1) os = "UNIX";
    else if (ua.indexOf("Linux") > -1) os = "Linux";
    else if (/Android/.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";

    return {
        browser,
        os,
        platform: isMobile ? "Mobile" : "Desktop",
        userAgent: ua
    };
};

/**
 * Checks for microphone and camera permissions via the Permissions API.
 * Note: Not all browsers support this API for 'microphone'/'camera'.
 */
export const getMediaPermissions = async () => {
    const permissions = { mic: 'unknown', camera: 'unknown' };
    try {
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const micStatus = await navigator.permissions.query({ name: 'microphone' });
                permissions.mic = micStatus.state;
            } catch (err) { /* ignore */ }

            try {
                const camStatus = await navigator.permissions.query({ name: 'camera' });
                permissions.camera = camStatus.state;
            } catch (err) { /* ignore */ }
        }
    } catch (e) {
        console.warn("Permissions API not supported or failed", e);
    }
    return permissions;
};

/**
 * Creates an audio analyzer to monitor the volume level of a stream.
 */
export const createAudioMonitor = (stream, onLevelUpdate) => {
    if (!stream || !stream.getAudioTracks().length) {
        console.warn("No audio tracks found in stream for monitoring");
        return null;
    }
    
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        let animationId;
        let lastLevel = 0;

        const update = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = Math.round(sum / bufferLength);
            
            // Only notify if level changed significantly to avoid spam
            if (Math.abs(average - lastLevel) > 2 || (average === 0 && lastLevel !== 0) || (average > 0 && lastLevel === 0)) {
                onLevelUpdate(average);
                lastLevel = average;
            }
            animationId = requestAnimationFrame(update);
        };
        
        update();
        
        return {
            stop: () => {
                cancelAnimationFrame(animationId);
                if (audioContext.state !== 'closed') {
                    audioContext.close();
                }
            }
        };
    } catch (e) {
        console.error("Audio monitor failed", e);
        return null;
    }
};
