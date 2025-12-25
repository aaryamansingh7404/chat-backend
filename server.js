import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import http from "http";               // ⭐ REQUIRED
import { Server } from "socket.io";    // ⭐ REQUIRED

const app = express();
app.use(express.json());
app.use(cors());

// 🌐 DB CONNECT
connectDB();

// 🛣 API Routes
app.use("/api/auth", authRoutes);

// 🏠 Test Route
app.get("/", (req, res) => res.send("API Running... 🚀"));

// 🔐 Protected Route
app.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Protected Route Accessed 🔐",
    user: req.user,
  });
});

// ⭐ Create HTTP Server for Socket.io
const server = http.createServer(app);

// ⭐ Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allowed origin - can change in production
    methods: ["GET", "POST"],
  },
});

// ⭐ SOCKET EVENTS ⭐
io.on("connection", (socket) => {
  console.log("⚡ New Client Connected:", socket.id);

  // Join Room
  socket.on("joinRoom", ({ roomId }) => {
    socket.join(roomId);
  });

  // Send Message
  socket.on("sendMessage", ({ roomId, message }) => {
    socket.to(roomId).emit("receiveMessage", message);
  });

  // Delivered (2 ticks)
  socket.on("messageDelivered", ({ roomId, messageId }) => {
    io.to(roomId).emit("updateMessageStatus", {
      id: messageId,
      status: "delivered",
    });
  });

  // Seen (Blue ticks)
  socket.on("chatOpened", ({ roomId }) => {
    io.to(roomId).emit("updateAllSeen");
  });

  socket.on("disconnect", () => {
    console.log("❌ Client Disconnected");
  });

});

// 🎯 PORT
const PORT = process.env.PORT || 5000;

// 🚀 START SERVER
server.listen(PORT, () => console.log(`🚀 Server with Socket.io on PORT ${PORT}`));
