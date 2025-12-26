import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { authMiddleware } from "./middleware/authMiddleware.js";

const app = express();
app.use(express.json());
app.use(cors());

// 📌 DB
connectDB();

// 📌 API ROUTES
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("API Running 🚀"));
app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Protected Route", user: req.user });
});

// 📌 SOCKET SERVER SETUP
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // 🌟 USER IDENTIFICATION
  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);
    console.log("🏠 Personal Room:", socket.userName);
  });

  // 🔗 PRIVATE CHAT ROOM JOIN
  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const roomId = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(roomId);
    console.log("🔗 Joined:", roomId);
  });

  // 💬 SEND MESSAGE (Main Fix)
  socket.on("sendMessage", (msg) => {
    const { sender, receiver } = msg;
    if (!sender || !receiver) return;

    const roomId = [sender.trim(), receiver.trim()].sort().join("_");

    io.to(roomId).emit("receiveMessage", msg);
    io.to(receiver.trim()).emit("backgroundMessage", msg);

    socket.emit("messageSentConfirm", { id: msg.id, status: "sent" });
  });

  // ✔ Delivered
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    const roomId = [sender.trim(), receiver.trim()].sort().join("_");
    io.to(roomId).emit("updateMessageStatus", { id, status: "delivered" });
  });

  // ✔✔ Seen
  socket.on("chatOpened", ({ user1, user2 }) => {
    const roomId = [user1.trim(), user2.trim()].sort().join("_");
    io.to(roomId).emit("updateAllSeen");
  });

  // 🟢 ONLINE
  socket.on("userOnline", ({ userName }) => {
    io.emit("statusUpdate", {
      userName: userName.trim(),
      status: "online",
      lastSeen: null,
    });
  });

  // 🔴 OFFLINE
  socket.on("userOffline", ({ userName }) => {
    const time = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
    io.emit("statusUpdate", {
      userName: userName.trim(),
      status: "offline",
      lastSeen: time,
    });
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {
    if (!socket.userName) return;
    const time = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
    io.emit("statusUpdate", {
      userName: socket.userName,
      status: "offline",
      lastSeen: time,
    });
    console.log("❌ LEFT:", socket.userName);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
