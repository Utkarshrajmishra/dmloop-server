const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Store rooms and their users
const rooms = new Map();
const chat = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", ({ room, name, email, photoUrl }) => {
    socket.join(room);

    // Initialize room if it doesn't exist
    if (!rooms.has(room)) {
      rooms.set(room, new Map());
    }
    // Add user to room
    const roomUsers = rooms.get(room);
    roomUsers.set(email, { name, email, photoUrl, socketId: socket.id, wpm:0, error:0, time:0 });

    console.log(
      "After adding user, room users:",
      Array.from(roomUsers.values())
    );
    // Store room info in socket for easy cleanup
    socket.roomData = { room, email };

    // Emit current user list to all users in room
    io.to(room).emit("users_updated", Array.from(roomUsers.values()));

    console.log(`User ${name} joined room ${room}`);
  });

  socket.on("start_game",(room)=>{
      io.to(room).emit("game_started",true)
  })

  socket.on("game_completed",( {email, wpm, error, time, room})=>{
      const roomData=rooms.get(room);
      const user=roomData.get(email);
      roomData.set(email, {...user, wpm:wpm, error: error, time:time});
  })

  socket.on("send_score", (room)=>{
          const roomData = rooms.get(room);
          console.log(room)
          io.to(room).emit("scores", Array.from(roomData.values()))
  })

  socket.on("message_sent", ({ msg, room, name, email }) => {
    if (!chat.has(room)) {
      chat.set(room, new Array());
    }
    const messages = chat.get(room);
    messages.push({ msg, name, email });
    io.to(room).emit("message_recevied", messages);
  });

  socket.on("leave_room", ({ room, email }) => {
    handleUserLeave(socket, room, email);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    if (socket.roomData) {
      handleUserLeave(socket, socket.roomData.room, socket.roomData.email);
    }
  });
});

// Helper function to handle user leaving
function handleUserLeave(socket, room, email) {
  if (rooms.has(room)) {
    const roomUsers = rooms.get(room);

    // Remove user from room
    roomUsers.delete(email);

    // If room is empty, delete it
    if (roomUsers.size === 0) {
      rooms.delete(room);
      chat.delete(room);
      console.log(`Room ${room} deleted`);
    } else {
      // Notify remaining users
      io.to(room).emit("users_updated", Array.from(roomUsers.values()));
    }

    socket.leave(room);
    console.log(`User ${email} left room ${room}`);
  }
}

server.listen(8001, () => {
  console.log("Server is running on port 8001");
});
