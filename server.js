import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();
app.use(express.json());
app.use(cors());

connectDB();

app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("API Running 🚀"));

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
    const room = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(room);
  });

  // 📩 SEND MESSAGE FIXED
  socket.on("sendMessage", (msg) => {
    const { sender, receiver } = msg;
    if (!sender || !receiver) return;

    const room = [sender.trim(), receiver.trim()].sort().join("_");
    
    // only RECEIVER gets message
    io.to(room).emit("receiveMessage", msg);

    // background notification if receiver not open
    const inRoom = io.sockets.adapter.rooms.get(room)?.size > 1;
    if (!inRoom) io.to(receiver).emit("backgroundMessage", msg);

    // sender gets confirmation only
    io.to(sender).emit("messageSentConfirm", {
      id: msg.id,
      receiver
    });
  });

  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    const room = [sender.trim(), receiver.trim()].sort().join("_");
    io.to(room).emit("updateMessageStatus", {
      id,
      sender,
      receiver,
      status: "delivered"
    });
  });

  socket.on("chatOpened", ({ opener, partner }) => {
    if (!opener || !partner) return;
    const room = [opener.trim(), partner.trim()].sort().join("_");
    io.to(room).emit("updateAllSeen", { opener, partner });
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
