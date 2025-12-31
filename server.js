import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import multer from "multer"; 

const app = express();
app.use(express.json());
app.use(cors());

connectDB();
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.send("API Running 🚀"));


//status part
let statusList = [];

// Multer storage for uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Serve uploaded images
app.use("/uploads", express.static("uploads"));

// 📤 STATUS UPLOAD
app.post("/upload-status", upload.single("statusFile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  statusList.push({
    id: Date.now(),
    file: fileUrl,
    createdAt: Date.now(),
  });

  console.log("📸 Status Uploaded:", fileUrl);
  res.json({ message: "Status Uploaded", fileUrl });
});

// 📥 GET ALL STATUS
app.get("/get-status", (req, res) => {
  res.json(statusList);
});

//status part end

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ⭐ USER STATUS MEMORY
const userStatus = {};

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // ⭐ LOGIN / APP START → ONLINE
  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);

    userStatus[userName] = {
      online: true,
      lastSeen: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    io.emit("statusUpdate", { user: userName, ...userStatus[userName] });
  });

  // ⭐ APP ACTIVE (foreground) → ONLINE
  socket.on("userActive", (userName) => {
    if (!userName) return;

    userStatus[userName] = {
      online: true,
      lastSeen: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    io.emit("statusUpdate", { user: userName, ...userStatus[userName] });
  });

  // ⭐ ROOM FOR MESSAGES
  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;
    const room = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(room);
  });

  // ⭐ MESSAGE
  socket.on("sendMessage", (msg) => {
    const { sender, receiver, forList } = msg;
    if (!sender || !receiver) return;

    const room = [sender.trim(), receiver.trim()].sort().join("_");
    io.to(room).emit("receiveMessage", msg);

    if (forList) {
      io.to(sender).emit("receiveMessage", { ...msg, fromSelf: true });
    }

    socket.emit("messageSentConfirm", {
      id: msg.id,
      status: "sent",
      receiver,
    });
  });

  // ⭐ DELIVERED
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    if (!id || !sender || !receiver) return;
    io.to(sender.trim()).emit("updateMessageStatus", {
      id,
      status: "delivered",
      sender,
      receiver,
    });
  });

  // ⭐ SEEN
  socket.on("chatOpened", ({ opener, partner }) => {
    if (!opener || !partner) return;
    const room = [opener.trim(), partner.trim()].sort().join("_");
    io.to(room).emit("updateAllSeen", { opener, partner });
  });

  // ⭐ TYPING
  socket.on("typing", ({ to, typing }) => io.to(to).emit("typing", { typing }));
  // ⭐ USER GOES INACTIVE (app background/minimize) ⭐
socket.on("userInactive", (userName) => {
  if (!userName) return;
  userStatus[userName] = {
    online: false,
    lastSeen: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }),
  };
  io.emit("statusUpdate", { user: userName, ...userStatus[userName] });
});


  // ⭐ DISCONNECT / MINIMIZE / NET OFF → LAST SEEN
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
