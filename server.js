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

// 📌 DB Connection
connectDB();

// 📌 Routes
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("API Running 🚀"));
app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Protected Route", user: req.user });
});

// 📌 SOCKET SERVER
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ⚡ SOCKET EVENTS
io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // 🛑 FIX → auto join user to personal room
  socket.on("initUser", ({ userName }) => {
    socket.userName = userName.trim();
    socket.join(userName.trim()); // personal inbox room
    console.log("📥 personal room joined:", userName);
  });

  // 🛑 FIX: Chat room ID should be same for both users
  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const roomId = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(roomId);
    console.log("🔗 Joined room:", roomId);
  });

  // 🟢 Send Message
  socket.on("sendMessage", ({ sender, receiver, text, id, time }) => {
    const roomId = [sender.trim(), receiver.trim()].sort().join("_");

    const message = { id, text, sender, time, status: "sent" };

    // 🔥 Send to chat screen (if open)
    io.to(roomId).emit("receiveMessage", message);

    // 📩 ALWAYS store in receiver personal inbox (background receive)
    io.to(receiver.trim()).emit("backgroundMessage", message);

    socket.emit("messageSentConfirm", { id, status: "sent" });
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

  // 🟢 Online
  socket.on("userOnline", ({ userName }) => {
    io.emit("statusUpdate", {
      userName: userName.trim(),
      status: "online",
      lastSeen: null,
    });
  });

  // 🔴 Offline
  socket.on("userOffline", ({ userName }) => {
    const time = new Date().toLocaleString("en-IN", {
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

  // ❌ Disconnect
  socket.on("disconnect", () => {
    if (!socket.userName) return;
    const time = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });

    io.emit("statusUpdate", {
      userName: socket.userName,
      status: "offline",
      lastSeen: time,
    });

    console.log("❌ AUTO OFFLINE:", socket.userName, time);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
