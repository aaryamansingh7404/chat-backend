import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import multer from "multer";
import { extname } from "path"; // ⭐ IMPORTANT FIX

const app = express();
app.use(express.json());
app.use(cors());

connectDB();
app.use("/api/auth", authRoutes);

// HOME CHECK
app.get("/", (req, res) => res.send("API Running 🚀"));

// 🕒 India Time Zone Function
function getIndiaTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}


/* ⭐⭐⭐ STATUS FEATURE START ⭐⭐⭐ */
let statusList = [];

// Multer storage for uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const fileExt = extname(file.originalname) || ".jpg"; // ⭐ EXT FIX
    cb(null, Date.now() + fileExt);
  },
});

const upload = multer({ storage });

// Serve uploaded images
app.use("/uploads", express.static("uploads"));


// 📤 STATUS UPLOAD - (ADD STATUS)
app.post("/upload-status", upload.single("statusFile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { user } = req.body;

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  const newStatus = {
    id: Date.now().toString(),
    user: user || "Unknown",
    file: fileUrl,
    time: getIndiaTime(),
    date: "Today",
  };

  statusList.push(newStatus);

  res.json({ message: "Status Uploaded", data: newStatus });
});


// 📥 GET STATUS LIST
app.get("/get-status", (req, res) => {
  res.json(statusList);
});


// 🗑️ DELETE STATUS - (Only Owner Status Delete)
app.post("/delete-status", (req, res) => {
  const { id } = req.body;

  const before = statusList.length;
  statusList = statusList.filter((s) => s.id.toString() !== id.toString());
  const after = statusList.length;

  if (before === after) {
    return res.status(404).json({ message: "Status Not Found" });
  }

  res.json({ message: "Deleted Successfully" });
});
/* ⭐⭐⭐ STATUS FEATURE END ⭐⭐⭐ */




/* ⭐⭐⭐ SOCKET.IO CODE (YOUR ORIGINAL) ⭐⭐⭐ */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const userStatus = {};

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);

    userStatus[userName] = {
      online: true,
      lastSeen: getIndiaTime(),
    };

    io.emit("statusUpdate", { user: userName, ...userStatus[userName] });
  });

  socket.on("userActive", (userName) => {
    if (!userName) return;
    userStatus[userName] = {
      online: true,
      lastSeen: getIndiaTime(),
    };
    io.emit("statusUpdate", { user: userName, ...userStatus[userName] });
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
    io.to(room).emit("receiveMessage", { ...msg, time: getIndiaTime() });
    if (forList) {
      io.to(sender).emit("receiveMessage", { ...msg, time: getIndiaTime(), fromSelf: true });
    }
    socket.emit("messageSentConfirm", {
      id: msg.id,
      status: "sent",
      receiver,
    });
  });

  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    if (!id || !sender || !receiver) return;
    io.to(sender.trim()).emit("updateMessageStatus", {
      id,
      status: "delivered",
      sender,
      receiver,
    });
  });

  socket.on("chatOpened", ({ opener, partner }) => {
    if (!opener || !partner) return;
    const room = [opener.trim(), partner.trim()].sort().join("_");
    io.to(room).emit("updateAllSeen", { opener, partner });
  });

  socket.on("typing", ({ to, typing }) => io.to(to).emit("typing", { typing }));

  socket.on("userInactive", (userName) => {
    if (!userName) return;
    userStatus[userName] = {
      online: false,
      lastSeen: getIndiaTime(),
    };
    io.emit("statusUpdate", { user: userName, ...userStatus[userName] });
  });

  socket.on("disconnect", () => {
    if (!socket.userName) return;
    userStatus[socket.userName] = {
      online: false,
      lastSeen:getIndiaTime(),
    };

    io.emit("statusUpdate", {
      user: socket.userName,
      ...userStatus[socket.userName],
    });

    console.log("❌ Disconnected:", socket.id);
  });
});


/* ⭐⭐⭐ START SERVER ⭐⭐⭐ */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
