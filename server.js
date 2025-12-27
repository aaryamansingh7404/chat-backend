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

connectDB();

app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("API Running 🚀"));
app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Protected", user: req.user });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

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

  // ⭐ SEND MESSAGE (Final Logic)
  socket.on("sendMessage", (msg) => {
    const { sender, receiver } = msg;
    if (!sender || !receiver) return;

    const room = [sender, receiver].sort().join("_");

    // 📩 Send message to chat room users
    io.to(room).emit("receiveMessage", msg);

    // 🎯 background notification only if not in room
    const isReceiverInRoom = io.sockets.adapter.rooms.get(room)?.size > 1;
    if (!isReceiverInRoom) {
      io.to(receiver).emit("backgroundMessage", msg);
    }

    // 🚀 Sender confirmation
    socket.emit("messageSentConfirm", { id: msg.id, status: "sent" });
  });

  // ⭐ DELIVERED WHEN RECEIVER CONFIRMS MESSAGE ARRIVAL
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    const room = [sender, receiver].sort().join("_");
    io.to(room).emit("updateMessageStatus", {
      id,
      sender,
      receiver,
      status: "delivered",
    });
  });

  
  // ⭐ Seen ONLY when the real receiver opens chat
socket.on("chatOpened", ({ opener, partner }) => {
  if (!opener || !partner) return;

  const room = [opener.trim(), partner.trim()].sort().join("_");

  // 👉 Only the receiver of messages can mark them seen
  io.to(room).emit("updateAllSeen", {
    opener,        // jisne chat khola
    receiver: opener,  // ye hi dekh raha hai
    partner,       // jisko message bheja tha
    status: "seen"
  });
});


  socket.on("userOnline", ({ userName }) => {
    io.emit("statusUpdate", { userName, status: "online", lastSeen: null });
  });

  socket.on("userOffline", ({ userName }) => {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    io.emit("statusUpdate", { userName, status: "offline", lastSeen: time });
  });

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
