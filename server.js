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
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// ⭐ USER STATUS MAP ⭐
let userStatus = {}; 
// { username : {online:true/false, lastSeen:"time"} }

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // ⭐ USER LOGIN/ACTIVE
  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);

    userStatus[socket.userName] = {
      online: true,
      lastSeen: "Online"
    };

    io.emit("userStatusUpdate", { user: socket.userName, ...userStatus[socket.userName] });
  });

  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const room = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(room);
  });

  socket.on("sendMessage", (msg) => {
    const { sender, receiver, forList } = msg;
    if (!sender || !receiver) return;

    const room = [sender.trim(), receiver.trim()].sort().join("_");
    io.to(room).emit("receiveMessage", msg);

    if (forList) io.to(sender).emit("receiveMessage", { ...msg, fromSelf: true });

    const inRoom = io.sockets.adapter.rooms.get(room)?.size > 1;
    if (!inRoom) io.to(receiver).emit("backgroundMessage", msg);

    socket.emit("messageSentConfirm", { id: msg.id, status: "sent", receiver });
  });

  socket.on("messageDelivered", ({ id, sender }) => {
    io.to(sender.trim()).emit("updateMessageStatus", { id, status: "delivered" });
  });

  socket.on("chatOpened", ({ opener, partner }) => {
    const room = [opener.trim(), partner.trim()].sort().join("_");
    io.to(room).emit("updateAllSeen", { opener, partner });
  });

  // ❌ DISCONNECT → OFFLINE
  socket.on("disconnect", () => {
    if (socket.userName) {
      userStatus[socket.userName] = {
        online: false,
        lastSeen: new Date().toLocaleString()
      };
      io.emit("userStatusUpdate", { user: socket.userName, ...userStatus[socket.userName] });
    }
    console.log("🚫 Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
