import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(express.json());
app.use(cors());

// DB
connectDB();

// Routes
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => res.send("API Running... 🚀"));

// Protected Test
app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Protected 🔐", user: req.user });
});

// HTTP SERVER FOR SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ⚡ USER ONLINE / OFFLINE + TICKS
io.on("connection", (socket) => {
  console.log("⚡ Client Connected:", socket.id);

  socket.on("joinRoom", ({ roomId, userName }) => {
    socket.userName = userName;
    socket.join(roomId);

    // 🟢 ONLINE STATUS
    io.emit("statusUpdate", {
      userName,
      status: "online",
      lastSeen: null,
    });
  });

  // SEND MESSAGE
  socket.on("sendMessage", ({ roomId, message }) => {
    socket.to(roomId).emit("receiveMessage", message);
  });

  // DELIVERED
  socket.on("messageDelivered", ({ roomId, messageId }) => {
    io.to(roomId).emit("updateMessageStatus", {
      id: messageId,
      status: "delivered",
    });
  });

  // SEEN
  socket.on("chatOpened", ({ roomId }) => {
    io.to(roomId).emit("updateAllSeen");
  });

  // 🔴 DISCONNECT → LAST SEEN
  socket.on("disconnect", () => {
    const lastSeen = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    io.emit("statusUpdate", {
      userName: socket.userName,
      status: "offline",
      lastSeen,
    });

    console.log("❌ Disconnected:", socket.id);
  });
});

// PORT
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server live on ${PORT}`));
