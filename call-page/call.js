// Video call page - WebRTC implementation
(function () {
    'use strict';

    // Configuration
    const SIGNALING_URL = 'wss://wpcall-signaling.ajcoolx619.workers.dev';

    // ICE servers - STUN and TURN for reliability
    const ICE_SERVERS = [
        // Google STUN servers (free)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // OpenRelay TURN servers (free, limited)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ];

    // State
    let peerConnection = null;
    let localStream = null;
    let remoteStream = null;
    let ws = null;
    let roomId = null;
    let token = null;
    let isInitiator = false;
    let audioEnabled = true;
    let videoEnabled = true;

    // DOM elements
    const screens = {
        status: document.getElementById('status-screen'),
        waiting: document.getElementById('waiting-screen'),
        call: document.getElementById('call-screen'),
        ended: document.getElementById('ended-screen'),
        error: document.getElementById('error-screen')
    };

    const elements = {
        statusText: document.getElementById('status-text'),
        errorText: document.getElementById('error-text'),
        localVideo: document.getElementById('local-video'),
        remoteVideo: document.getElementById('remote-video'),
        btnMic: document.getElementById('btn-mic'),
        btnVideo: document.getElementById('btn-video'),
        btnScreen: document.getElementById('btn-screen'),
        btnEnd: document.getElementById('btn-end'),
        btnClose: document.getElementById('btn-close'),
        btnRetry: document.getElementById('btn-retry')
    };

    // Parse URL params
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            room: params.get('room'),
            token: params.get('token'),
            audioOnly: params.get('audio') === '1'
        };
    }

    // Show screen
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
        }
    }

    // Show error
    function showError(message) {
        elements.errorText.textContent = message;
        showScreen('error');
    }

    // Get user media
    async function getLocalStream(audioOnly = false) {
        try {
            const constraints = {
                audio: true,
                video: audioOnly ? false : {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            };

            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            elements.localVideo.srcObject = localStream;

            return true;
        } catch (error) {
            console.error('Failed to get media:', error);

            if (error.name === 'NotAllowedError') {
                showError('Camera/microphone access denied');
            } else if (error.name === 'NotFoundError') {
                showError('No camera or microphone found');
            } else {
                showError('Failed to access media devices');
            }

            return false;
        }
    }

    // Create peer connection
    function createPeerConnection() {
        const config = {
            iceServers: ICE_SERVERS,
            iceCandidatePoolSize: 10
        };

        peerConnection = new RTCPeerConnection(config);

        // Add local tracks
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }

        // Handle incoming tracks
        peerConnection.ontrack = (event) => {
            console.log('Received remote track');
            if (event.streams && event.streams[0]) {
                remoteStream = event.streams[0];
                elements.remoteVideo.srcObject = remoteStream;
            }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);

            switch (peerConnection.connectionState) {
                case 'connected':
                    showScreen('call');
                    break;
                case 'disconnected':
                case 'failed':
                    handleCallEnded();
                    break;
                case 'closed':
                    // Already handled
                    break;
            }
        };

        // Handle ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE state:', peerConnection.iceConnectionState);

            if (peerConnection.iceConnectionState === 'failed') {
                // Try ICE restart
                peerConnection.restartIce();
            }
        };

        return peerConnection;
    }

    // Send signal through WebSocket
    function sendSignal(data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    // Connect to signaling server
    function connectSignaling() {
        return new Promise((resolve, reject) => {
            const wsUrl = `${SIGNALING_URL}?room=${roomId}&token=${token}`;
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('Connected to signaling server');
                resolve();
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(new Error('Failed to connect to signaling server'));
            };

            ws.onclose = () => {
                console.log('Signaling connection closed');
            };

            ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                await handleSignalMessage(data);
            };
        });
    }

    // Handle incoming signal messages
    async function handleSignalMessage(data) {
        console.log('Signal received:', data.type);

        switch (data.type) {
            case 'room-info':
                isInitiator = data.isInitiator;
                if (isInitiator) {
                    showScreen('waiting');
                }
                break;

            case 'peer-joined':
                // Other participant joined, create offer
                if (isInitiator) {
                    await createAndSendOffer();
                }
                showScreen('call');
                break;

            case 'offer':
                await handleOffer(data.offer);
                break;

            case 'answer':
                await handleAnswer(data.answer);
                break;

            case 'ice-candidate':
                await handleIceCandidate(data.candidate);
                break;

            case 'peer-left':
                handleCallEnded();
                break;

            case 'error':
                showError(data.message || 'Connection error');
                break;
        }
    }

    // Create and send offer
    async function createAndSendOffer() {
        if (!peerConnection) createPeerConnection();

        try {
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await peerConnection.setLocalDescription(offer);

            sendSignal({
                type: 'offer',
                offer: peerConnection.localDescription
            });
        } catch (error) {
            console.error('Failed to create offer:', error);
            showError('Failed to start call');
        }
    }

    // Handle incoming offer
    async function handleOffer(offer) {
        if (!peerConnection) createPeerConnection();

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            sendSignal({
                type: 'answer',
                answer: peerConnection.localDescription
            });
        } catch (error) {
            console.error('Failed to handle offer:', error);
            showError('Failed to connect call');
        }
    }

    // Handle incoming answer
    async function handleAnswer(answer) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Failed to handle answer:', error);
        }
    }

    // Handle ICE candidate
    async function handleIceCandidate(candidate) {
        try {
            if (peerConnection && candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }

    // Toggle microphone
    function toggleMic() {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioEnabled = !audioEnabled;
                audioTrack.enabled = audioEnabled;

                elements.btnMic.classList.toggle('muted', !audioEnabled);
                elements.btnMic.querySelector('.icon-on').classList.toggle('hidden', !audioEnabled);
                elements.btnMic.querySelector('.icon-off').classList.toggle('hidden', audioEnabled);
            }
        }
    }

    // Toggle video
    function toggleVideo() {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoEnabled = !videoEnabled;
                videoTrack.enabled = videoEnabled;

                elements.btnVideo.classList.toggle('muted', !videoEnabled);
                elements.btnVideo.querySelector('.icon-on').classList.toggle('hidden', !videoEnabled);
                elements.btnVideo.querySelector('.icon-off').classList.toggle('hidden', videoEnabled);
            }
        }
    }

    // Share screen
    async function shareScreen() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            const videoTrack = screenStream.getVideoTracks()[0];

            // Replace video track
            const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }

            // Show screen in local preview
            elements.localVideo.srcObject = screenStream;

            // When screen sharing stops, revert to camera
            videoTrack.onended = async () => {
                const cameraTrack = localStream.getVideoTracks()[0];
                if (sender && cameraTrack) {
                    await sender.replaceTrack(cameraTrack);
                }
                elements.localVideo.srcObject = localStream;
                elements.btnScreen.classList.remove('active');
            };

            elements.btnScreen.classList.add('active');
        } catch (error) {
            console.error('Failed to share screen:', error);
        }
    }

    // End call
    function endCall() {
        cleanup();
        sendSignal({ type: 'leave' });
        showScreen('ended');
    }

    // Handle call ended by other participant
    function handleCallEnded() {
        cleanup();
        showScreen('ended');
    }

    // Cleanup resources
    function cleanup() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        if (ws) {
            ws.close();
            ws = null;
        }
    }

    // Initialize
    async function init() {
        const params = getUrlParams();

        if (!params.room || !params.token) {
            showError('Invalid call link');
            return;
        }

        roomId = params.room;
        token = params.token;

        elements.statusText.textContent = 'Accessing camera...';

        // Get local media
        const hasMedia = await getLocalStream(params.audioOnly);
        if (!hasMedia) return;

        elements.statusText.textContent = 'Connecting...';

        // Create peer connection
        createPeerConnection();

        // Connect to signaling
        try {
            await connectSignaling();
        } catch (error) {
            showError(error.message);
            return;
        }
    }

    // Event listeners
    elements.btnMic.addEventListener('click', toggleMic);
    elements.btnVideo.addEventListener('click', toggleVideo);
    elements.btnScreen.addEventListener('click', shareScreen);
    elements.btnEnd.addEventListener('click', endCall);
    elements.btnClose.addEventListener('click', () => window.close());
    elements.btnRetry.addEventListener('click', () => location.reload());

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        sendSignal({ type: 'leave' });
        cleanup();
    });

    // Start
    init();
})();
