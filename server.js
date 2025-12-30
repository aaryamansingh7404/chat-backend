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

/* ⭐ USER STATUS TRACKER ⭐ */
const userStatus = {}; 
// { username : {online:true/false, lastSeen:"time"} }

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  /* ⭐ User Init / Online */
  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);

    userStatus[userName] = { online: true, lastSeen: "now" };
    io.emit("statusUpdate", { user: userName, ...userStatus[userName] });
  });

  /* ⭐ Chat Room Join */
  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const room = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(room);
  });

  /* ⭐ Send Message (🔥 THIS WAS MISSING) */
  socket.on("sendMessage", (msg) => {
    const { sender, receiver, forList } = msg;
    if (!sender || !receiver) return;

    const room = [sender.trim(), receiver.trim()].sort().join("_");

    // Room me message
    io.to(room).emit("receiveMessage", msg);

    // Sender ke personal list update
    if (forList) io.to(sender).emit("receiveMessage", { ...msg, fromSelf: true });

    // Delivered confirm
    socket.emit("messageSentConfirm", { id: msg.id, status: "sent", receiver });
  });

  /* ⭐ Delivered Update */
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    if (!id || !sender || !receiver) return;
    io.to(sender.trim()).emit("updateMessageStatus", {
      id,
      status: "delivered",
      sender,
      receiver
    });
  });

  /* ⭐ Seen Update */
  socket.on("chatOpened", ({ opener, partner }) => {
    if (!opener || !partner) return;
    const room = [opener.trim(), partner.trim()].sort().join("_");
    io.to(room).emit("updateAllSeen", { opener, partner });
  });

  /* ⭐ DISCONNECT → offline + last seen */
  socket.on("disconnect", () => {
    if (!socket.userName) return;

    userStatus[socket.userName] = {
      online: false,
      lastSeen: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    io.emit("statusUpdate", {
      user: socket.userName,
      ...userStatus[socket.userName],
    });

    console.log("❌ Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
