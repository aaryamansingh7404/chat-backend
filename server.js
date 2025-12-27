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

  // USER INIT
  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);
  });

  // JOIN ROOM
  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const room = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(room);
  });

  // SEND MESSAGE
  socket.on("sendMessage", (msg) => {
    const { sender, receiver, forList } = msg;
    if (!sender || !receiver) return;

    const room = [sender.trim(), receiver.trim()].sort().join("_");

    io.to(room).emit("receiveMessage", msg);

    if (forList) {
      io.to(sender).emit("receiveMessage", { ...msg, fromSelf: true });
    }

    const inRoom = io.sockets.adapter.rooms.get(room)?.size > 1;
    if (!inRoom) {
      io.to(receiver).emit("backgroundMessage", msg);
    }

    socket.emit("messageSentConfirm", {
      id: msg.id,
      status: "sent",
      receiver,
    });
  });

  // DELIVERED
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    const room = [sender.trim(), receiver.trim()].sort().join("_");
    io.to(room).emit("updateMessageStatus", { id, sender, receiver, status: "delivered" });
  });

  // ⭐ FIXED SEEN ⭐
  socket.on("chatOpened", ({ opener, partner }) => {
    if (!opener || !partner) return;
    const room = [opener.trim(), partner.trim()].sort().join("_");

    io.to(room).emit("updateAllSeen", { opener, partner });
    io.to(opener).emit("updateAllSeen", { opener, partner });
    io.to(partner).emit("updateAllSeen", { opener, partner });
  });

  // CHATLIST PREVIEW
  socket.on("updateChatListPreview", ({ user1, user2, lastMsg, time }) => {
    if (!user1 || !user2) return;

    const room = [user1.trim(), user2.trim()].sort().join("_");

    io.to(user1).emit("updateChatListPreview", { user1, user2, lastMsg, time });
    io.to(user2).emit("updateChatListPreview", { user1, user2, lastMsg, time });
    io.to(room).emit("updateChatListPreview", { user1, user2, lastMsg, time });
  });

  // ONLINE / OFFLINE
  socket.on("userOnline", ({ userName }) => {
    io.emit("statusUpdate", { userName, status: "online", lastSeen: null });
  });

  socket.on("userOffline", ({ userName }) => {
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    io.emit("statusUpdate", { userName, status: "offline", lastSeen: time });
  });

  socket.on("disconnect", () => {
    if (!socket.userName) return;
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    io.emit("statusUpdate", {
      userName: socket.userName,
      status: "offline",
      lastSeen: time,
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
