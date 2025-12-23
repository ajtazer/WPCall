// WPCall Signaling Server - Cloudflare Workers with Durable Objects

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// Main worker
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Route requests
        if (url.pathname === '/room' && request.method === 'POST') {
            return handleCreateRoom(request, env);
        }

        if (url.pathname.startsWith('/room/') && request.method === 'GET') {
            const roomId = url.pathname.split('/')[2];
            return handleCheckRoom(roomId, env);
        }

        // WebSocket upgrade for signaling
        if (request.headers.get('Upgrade') === 'websocket') {
            const roomId = url.searchParams.get('room');
            const token = url.searchParams.get('token');

            if (!roomId || !token) {
                return new Response('Missing room or token', { status: 400 });
            }

            // Get Durable Object for this room
            const roomObjectId = env.ROOMS.idFromName(roomId);
            const roomObject = env.ROOMS.get(roomObjectId);

            return roomObject.fetch(request);
        }

        return new Response('WPCall Signaling Server', {
            status: 200,
            headers: corsHeaders
        });
    }
};

// Create room endpoint
async function handleCreateRoom(request, env) {
    try {
        const { roomId, token, expiry } = await request.json();

        if (!roomId || !token) {
            return new Response(JSON.stringify({ error: 'Missing roomId or token' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Get Durable Object for this room
        const roomObjectId = env.ROOMS.idFromName(roomId);
        const roomObject = env.ROOMS.get(roomObjectId);

        // Initialize room
        await roomObject.fetch(new Request('http://internal/init', {
            method: 'POST',
            body: JSON.stringify({ token, expiry: expiry || 15 })
        }));

        return new Response(JSON.stringify({ success: true, roomId }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// Check room endpoint
async function handleCheckRoom(roomId, env) {
    try {
        const roomObjectId = env.ROOMS.idFromName(roomId);
        const roomObject = env.ROOMS.get(roomObjectId);

        const response = await roomObject.fetch(new Request('http://internal/status'));
        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ valid: false }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// Durable Object for room state
export class CallRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map(); // WebSocket sessions
        this.token = null;
        this.expiry = null;
        this.createdAt = null;
        this.used = false;
    }

    async fetch(request) {
        const url = new URL(request.url);

        // Internal endpoints
        if (url.pathname === '/init' && request.method === 'POST') {
            const { token, expiry } = await request.json();
            this.token = token;
            this.expiry = expiry;
            this.createdAt = Date.now();
            this.used = false;

            // Store in durable storage
            await this.state.storage.put('roomData', {
                token: this.token,
                expiry: this.expiry,
                createdAt: this.createdAt,
                used: this.used
            });

            return new Response(JSON.stringify({ success: true }));
        }

        if (url.pathname === '/status') {
            await this.loadState();

            const isValid = this.isValid();
            return new Response(JSON.stringify({
                valid: isValid,
                participants: this.sessions.size
            }), {
                status: isValid ? 200 : 410
            });
        }

        // WebSocket upgrade
        if (request.headers.get('Upgrade') === 'websocket') {
            return this.handleWebSocket(request);
        }

        return new Response('Not found', { status: 404 });
    }

    async loadState() {
        if (!this.token) {
            const data = await this.state.storage.get('roomData');
            if (data) {
                this.token = data.token;
                this.expiry = data.expiry;
                this.createdAt = data.createdAt;
                this.used = data.used;
            }
        }
    }

    isValid() {
        if (!this.createdAt || !this.expiry) return false;

        const expiryMs = this.expiry * 60 * 1000;
        const now = Date.now();

        return (now - this.createdAt) < expiryMs;
    }

    async handleWebSocket(request) {
        await this.loadState();

        // Check if room is valid
        if (!this.isValid()) {
            return new Response('Room expired', { status: 410 });
        }

        // Validate token
        const url = new URL(request.url);
        const token = url.searchParams.get('token');

        if (token !== this.token) {
            return new Response('Invalid token', { status: 403 });
        }

        // Limit to 2 participants (1:1 calls)
        if (this.sessions.size >= 2) {
            return new Response('Room full', { status: 409 });
        }

        // Create WebSocket pair
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Accept WebSocket
        server.accept();

        // Generate session ID
        const sessionId = crypto.randomUUID();
        const isInitiator = this.sessions.size === 0;

        // Store session
        this.sessions.set(sessionId, server);

        // Mark room as used
        if (!this.used && this.sessions.size > 0) {
            this.used = true;
            await this.state.storage.put('roomData', {
                token: this.token,
                expiry: this.expiry,
                createdAt: this.createdAt,
                used: this.used
            });
        }

        // Send room info
        server.send(JSON.stringify({
            type: 'room-info',
            sessionId,
            isInitiator,
            participants: this.sessions.size
        }));

        // Notify other participants
        if (this.sessions.size > 1) {
            this.broadcast({
                type: 'peer-joined',
                sessionId
            }, sessionId);
        }

        // Handle messages
        server.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data);

                // Relay signaling messages to other participant
                if (['offer', 'answer', 'ice-candidate'].includes(data.type)) {
                    this.broadcast(data, sessionId);
                }

                if (data.type === 'leave') {
                    this.handleLeave(sessionId);
                }
            } catch (error) {
                console.error('Message handling error:', error);
            }
        });

        // Handle close
        server.addEventListener('close', () => {
            this.handleLeave(sessionId);
        });

        server.addEventListener('error', (error) => {
            console.error('WebSocket error:', error);
            this.handleLeave(sessionId);
        });

        return new Response(null, {
            status: 101,
            webSocket: client
        });
    }

    broadcast(message, excludeSessionId) {
        const messageStr = JSON.stringify(message);

        for (const [sessionId, socket] of this.sessions) {
            if (sessionId !== excludeSessionId) {
                try {
                    socket.send(messageStr);
                } catch (error) {
                    console.error('Broadcast error:', error);
                }
            }
        }
    }

    handleLeave(sessionId) {
        const socket = this.sessions.get(sessionId);

        if (socket) {
            try {
                socket.close();
            } catch (e) { }

            this.sessions.delete(sessionId);

            // Notify remaining participant
            this.broadcast({
                type: 'peer-left',
                sessionId
            }, sessionId);
        }
    }
}
