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

// 🟢 ONLINE / LAST SEEN STORE
let userStatus = {}; 
// format: { username: { state:"online/offline", lastSeen: 1735559251123 } }

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // 🟢 USER INIT
  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    userName = userName.trim();
    socket.userName = userName;
    socket.join(userName);

    userStatus[userName] = { state: "online", lastSeen: null };
    io.emit("userStatusUpdate", { user: userName, ...userStatus[userName] });
  });

  // 🟢 MANUAL ONLINE PING (Optional)
  socket.on("userOnline", (user) => {
    if (!user) return;
    userStatus[user] = { state: "online", lastSeen: null };
    io.emit("userStatusUpdate", { user, ...userStatus[user] });
  });

  // 🔴 USER OFFLINE
  socket.on("userOffline", (user) => {
    if (!user) return;
    userStatus[user] = { state: "offline", lastSeen: Date.now() };
    io.emit("userStatusUpdate", { user, ...userStatus[user] });
  });

  // 🟣 JOIN ROOM
  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const room = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(room);
  });

  // 🔵 SEND MESSAGE
  socket.on("sendMessage", (msg) => {
    const { sender, receiver, forList } = msg;
    if (!sender || !receiver) return;

    const room = [sender.trim(), receiver.trim()].sort().join("_");

    io.to(room).emit("receiveMessage", msg);

    if (forList) {
      io.to(sender).emit("receiveMessage", { ...msg, fromSelf: true });
    }

    const inRoom = io.sockets.adapter.rooms.get(room)?.size > 1;
    if (!inRoom) io.to(receiver).emit("backgroundMessage", msg);

    socket.emit("messageSentConfirm", { id: msg.id, status: "sent", receiver });
  });

  // 🔵 DELIVERED
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    if (!id || !sender || !receiver) return;
    io.to(sender.trim()).emit("updateMessageStatus", {
      id, status: "delivered", sender, receiver
    });
  });

  // 🔵 SEEN
  socket.on("chatOpened", ({ opener, partner }) => {
    if (!opener || !partner) return;
    const room = [opener.trim(), partner.trim()].sort().join("_");
    io.to(room).emit("updateAllSeen", { opener, partner });
  });

  // 🔴 DISCONNECT
  socket.on("disconnect", () => {
    if (!socket.userName) return;

    userStatus[socket.userName] = {
      state: "offline",
      lastSeen: Date.now()
    };
    io.emit("userStatusUpdate", {
      user: socket.userName,
      ...userStatus[socket.userName]
    });

    console.log("❌ Disconnected:", socket.id);
  });
});

server.listen(process.env.PORT || 5000, () =>
  console.log(`🚀 Server running @ ${process.env.PORT || 5000}`)
);
