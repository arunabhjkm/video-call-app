const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.get('/', (req, res) => {
    res.send('Server is running');
});

// Map to track which room a user is in: socket.id -> roomID
const socketToRoom = {};
// Map to track user name: socket.id -> name
const socketToName = {};
// Map to track user type: socket.id -> type (client/lawyer)
const socketToType = {};
// Map to track users in a room: roomID -> [socket.id, ...]
const usersInRoom = {};

io.on('connection', socket => {
    socket.on("join room", payload => {
        let roomID, name, type;
        if (typeof payload === 'object') {
            roomID = payload.roomID;
            name = payload.name;
            type = payload.type || 'client'; // Default to client if not provided
        } else {
            roomID = payload;
            name = "Guest";
            type = 'client';
        }

        console.log(`[${socket.id}] joining room ${roomID} as ${name} (${type})`);
        socketToName[socket.id] = name;
        socketToType[socket.id] = type;

        if (usersInRoom[roomID]) {
            const length = usersInRoom[roomID].length;
            if (length === 4) {
                console.log(`[${socket.id}] Room ${roomID} is full (size: ${length})`);
                socket.emit("room full");
                return;
            }
            usersInRoom[roomID].push(socket.id);
        } else {
            usersInRoom[roomID] = [socket.id];
        }
        socketToRoom[socket.id] = roomID;

        // Prepare list of other users with their names and types
        const usersInThisRoom = usersInRoom[roomID]
            .filter(id => id !== socket.id)
            .map(id => ({
                id,
                name: socketToName[id],
                type: socketToType[id]
            }));

        console.log(`[${socket.id}] Sending 'all users': ${JSON.stringify(usersInThisRoom)}`);
        socket.emit("all users", usersInThisRoom);
    });

    socket.on("sending signal", payload => {
        console.log(`[${socket.id}] sending signal to ${payload.userToSignal} (Caller: ${payload.callerID})`);
        const callerName = socketToName[payload.callerID] || "Guest";
        const callerType = socketToType[payload.callerID] || "client";
        io.to(payload.userToSignal).emit('user joined', {
            signal: payload.signal,
            callerID: payload.callerID,
            callerName: callerName,
            callerType: callerType,
            callerStatus: payload.callerStatus // Pass MIC/CAM status
        });
    });

    socket.on("returning signal", payload => {
        console.log(`[${socket.id}] returning signal to ${payload.callerID}`);
        io.to(payload.callerID).emit('receiving returned signal', {
            signal: payload.signal,
            id: socket.id,
            status: payload.status // Pass MIC/CAM status
        });
    });

    socket.on('disconnect', () => {
        console.log(`[${socket.id}] disconnected`);
        const roomID = socketToRoom[socket.id];
        let room = usersInRoom[roomID];
        if (room) {
            room = room.filter(id => id !== socket.id);
            usersInRoom[roomID] = room;
            console.log(`Room ${roomID} updated members: ${JSON.stringify(room)}`);
        }
        delete socketToName[socket.id];
        delete socketToType[socket.id];
        delete socketToRoom[socket.id];

        // Ideally emit a "user left" event here so clients can remove the video
        socket.broadcast.emit('user left', socket.id);
    });

    socket.on("update status", payload => {
        const roomID = socketToRoom[socket.id];
        if (roomID) {
            // Broadcast to everyone else in the room
            socket.to(roomID).emit("status update", {
                id: socket.id,
                ...payload
            });
        }
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
