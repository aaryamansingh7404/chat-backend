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

// ⭐ DB
connectDB();

// ⭐ ROUTES
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("API Running 🚀"));
app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Protected", user: req.user });
});

// ⭐ SOCKET SERVER
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ⚡ SOCKET LOGIC
io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);
  });

  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const rid = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(rid);
  });

  // ⭐ SEND MESSAGE
  socket.on("sendMessage", (msg) => {
    const { sender, receiver } = msg;
    if (!sender || !receiver) return;

    const room = [sender, receiver].sort().join("_");

    io.to(room).emit("receiveMessage", msg);
    io.to(receiver).emit("backgroundMessage", msg);

    socket.emit("messageSentConfirm", { id: msg.id, status: "sent" });

    // delivered if receiver active
    const active = [...io.sockets.adapter.rooms.get(receiver) || []];
    if (active.length > 0) {
      io.to(room).emit("updateMessageStatus", {
        id: msg.id,
        sender,
        receiver,
        status: "delivered",
      });
    }
  });

  // ⭐ RECEIVER SEEN (chat open)
  socket.on("chatOpened", ({ user1, user2, opener }) => {
    const room = [user1.trim(), user2.trim()].sort().join("_");
  
    const partner = opener === user1 ? user2 : user1;
  
    io.to(room).emit("updateAllSeen", {
      opener,
      receiver: partner,   // chatList logic ke liye correct
      status: "seen"
    });
  });
  
  

  //  DELIVERY ACK
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    const room = [sender, receiver].sort().join("_");
    io.to(room).emit("updateMessageStatus", {
      id,
      sender,
      receiver,
      status: "delivered",
    });
  });

  //  ONLINE
  socket.on("userOnline", ({ userName }) => {
    io.emit("statusUpdate", { userName, status: "online", lastSeen: null });
  });

  // ⭐ OFFLINE
  socket.on("userOffline", ({ userName }) => {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    io.emit("statusUpdate", { userName, status: "offline", lastSeen: time });
  });

  // ⭐ DISCONNECT
  socket.on("disconnect", () => {
    if (!socket.userName) return;
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    io.emit("statusUpdate", {
      userName: socket.userName,
      status: "offline",
      lastSeen: time,
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
