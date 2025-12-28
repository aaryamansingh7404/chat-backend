import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.send("API Running 🚀"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// 🚀 SOCKET HANDLERS
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

  // 📩 SEND MESSAGE - FIXED
  socket.on("sendMessage", (msg) => {
    const { sender, receiver } = msg;
    if (!sender || !receiver) return;

    const room = [sender.trim(), receiver.trim()].sort().join("_");
    
    // 👉 Receiver ONLY: gets message
    io.to(room).emit("receiveMessage", msg);

    // 👉 If receiver not in chat, background alert
    const inRoom = io.sockets.adapter.rooms.get(room)?.size > 1;
    if (!inRoom) io.to(receiver).emit("backgroundMessage", msg);

    // 👉 Sender only: get confirmation
    io.to(sender).emit("messageSentConfirm", {
      id: msg.id,
      receiver
    });
  });

  // 📌 Delivered
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    const room = [sender.trim(), receiver.trim()].sort().join("_");
    io.to(room).emit("updateMessageStatus", {
      id, status: "delivered", sender, receiver
    });
  });

  // 👁 SEEN (FIXED)
  socket.on("chatOpened", ({ opener, partner }) => {
    if (!opener || !partner) return;

    // ⭐ SEEN only when RECEIVER opens chat
    io.to(partner.trim()).emit("updateAllSeen", {
      viewer: opener,
      target: partner
    });
  });

});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`)
);
