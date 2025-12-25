import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("🔥 USER CONNECTED:", socket.id);

  /* 🏠 JOIN ROOM */
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`📌 User Joined Room: ${roomId}`);

    io.to(roomId).emit("roomJoined", {
      message: `User connected to room: ${roomId}`,
      socketId: socket.id,
    });
  });

  /* ✍️ TYPING INDICATOR */
  socket.on("typingState", ({ roomId, userName, typing }) => {
    socket.to(roomId).emit("typingState", { userName, typing });
  });

  /* 📨 SEND MESSAGE */
  socket.on("sendMessage", ({ roomId, message }) => {
    console.log("📩 New Message:", message.id);
    io.to(roomId).emit("receiveMessage", message);
  });

  /* ✔✔ MESSAGE DELIVERED */
  socket.on("messageDelivered", ({ roomId, messageId }) => {
    console.log("🚚 Delivered:", messageId);
    
    // Sirf delivered status update
    io.to(roomId).emit("updateMessageStatus", {
      id: messageId,
      status: "delivered",
    });
  });

  /* 👀 MESSAGE SEEN (BLUE TICK) */
  socket.on("seenMessages", ({ roomId, userName }) => {
    console.log(`👀 Seen by: ${userName} in Room: ${roomId}`);

    // Sirf messages jinke sender != seen karne wala user
    // unko blue tick banane ke liye seen broadcast
    io.to(roomId).emit("updateAllSeen", {
      seenBy: userName,
      status: "seen",
    });
  });

  /* ❌ DISCONNECT */
  socket.on("disconnect", () => {
    console.log("❌ USER DISCONNECTED:", socket.id);
  });
});

/* 🚀 START SERVER */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`⚡ Server Live on PORT ${PORT}`);
});
