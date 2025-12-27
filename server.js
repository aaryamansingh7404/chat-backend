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

  // 🟢 USER LOGIN INIT
  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);
  });

  // 🟢 JOIN PRIVATE ROOM
  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const room = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(room);
  });

  // 🟢 SEND MESSAGE
  socket.on("sendMessage", (msg) => {
    const { sender, receiver, forList } = msg;
    if (!sender || !receiver) return;

    const room = [sender.trim(), receiver.trim()].sort().join("_");
    const time = msg.time;

    // 🔥 Send to both inside room
    io.to(room).emit("receiveMessage", msg);

    // 👇 YE POINT IMPORTANT HAI
    // ChatList ko preview update milega instantly
    io.to(sender).emit("updateChatListPreview", {
      user1: sender,
      user2: receiver,
      lastMsg: msg.text,
      time,
    });
    io.to(receiver).emit("updateChatListPreview", {
      user1: sender,
      user2: receiver,
      lastMsg: msg.text,
      time,
    });

    // 🔥 Notification / background message
    const inRoom = io.sockets.adapter.rooms.get(room)?.size > 1;
    if (!inRoom) io.to(receiver).emit("backgroundMessage", msg);

    socket.emit("messageSentConfirm", { id: msg.id, status: "sent", receiver });
  });

  // 🟢 DELIVERED
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    const room = [sender, receiver].sort().join("_");
    io.to(room).emit("updateMessageStatus", { id, sender, receiver, status: "delivered" });
  });

  // 🟢 SEEN
  socket.on("chatOpened", ({ opener, partner }) => {
    if (!opener || !partner) return;
    const room = [opener, partner].sort().join("_");

    io.to(room).emit("updateAllSeen", { opener, partner });

    // ⭐ ChatList ko bhi seen refresh
    io.to(opener).emit("updateChatListPreview", {
      user1: opener,
      user2: partner,
      lastMsg: "",
      time: "",
    });
    io.to(partner).emit("updateChatListPreview", {
      user1: opener,
      user2: partner,
      lastMsg: "",
      time: "",
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
