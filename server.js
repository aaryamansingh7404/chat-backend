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

// DB
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("API Running 🚀"));
app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Protected Route", user: req.user });
});

// SOCKET SERVER
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ⚡ SOCKET EVENTS
io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  socket.on("joinRoom", ({ roomId, userName }) => {
    socket.userName = userName.trim();
    socket.join(roomId);

    io.emit("statusUpdate", {
      userName: socket.userName,
      status: "online",
      lastSeen: null,
    });
  });

  socket.on("userOnline", ({ userName }) => {
    socket.userName = userName.trim();
    io.emit("statusUpdate", {
      userName: socket.userName,
      status: "online",
      lastSeen: null,
    });
  });

  socket.on("userOffline", ({ userName }) => {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    io.emit("statusUpdate", {
      userName: userName.trim(),
      status: "offline",
      lastSeen: time,
    });

    console.log("⏹ MANUAL OFFLINE:", userName, time);
  });

  socket.on("sendMessage", ({ roomId, message }) => {
    socket.to(roomId).emit("receiveMessage", message);
  });

  socket.on("messageDelivered", ({ roomId, messageId }) => {
    io.to(roomId).emit("updateMessageStatus", {
      id: messageId,
      status: "delivered",
    });
  });

  socket.on("chatOpened", ({ roomId }) => {
    io.to(roomId).emit("updateAllSeen");
  });

  socket.on("disconnect", () => {
    if (!socket.userName) return;

    const time = new Date().toLocaleTimeString([], {
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
server.listen(PORT, () => console.log(`🚀 Server ready @ ${PORT}`));
