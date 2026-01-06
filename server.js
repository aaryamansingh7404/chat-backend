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
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

let statusList = [];
let statusViews = {};

// 🧹 AUTO DELETE STATUS AFTER 24 HOURS (runs every 1 hour)
setInterval(() => {
  const now = Date.now();

  statusList = statusList.filter(
    (s) => now - s.createdAt < 24 * 60 * 60 * 1000
  );

  // optional: clean views also
  Object.keys(statusViews).forEach((id) => {
    if (!statusList.find((s) => s.id === id)) {
      delete statusViews[id];
    }
  });
}, 60 * 60 * 1000); // ⏱️ every 1 hour

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const fileExt = extname(file.originalname) || ".jpg";
    cb(null, Date.now() + fileExt);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image") ||
      file.mimetype.startsWith("video")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image/video allowed"));
    }
  },
});

app.use("/uploads", express.static("uploads"));

app.post("/upload-status", upload.single("statusFile"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { user, type, duration } = req.body;

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;

  const inferredType = req.file.mimetype.startsWith("video")
    ? "video"
    : "image";
    const newStatus = {
      id: Date.now().toString(),
      user: user || "Unknown",
      file: fileUrl,
      type: type || inferredType,
      duration:
  inferredType === "video"
    ? Math.min(Number(duration || 0) * 1000, 30000) // 🔥 seconds → ms
    : 5000,
      createdAt: Date.now(),
    };
    

  statusList.push(newStatus);

  res.json({
    message: "Status Uploaded",
    data: newStatus,
  });
});

app.get("/get-status", (req, res) => {
  res.json(statusList); // old → new order preserved
});

app.post("/status/view", (req, res) => {
  const { statusId, viewer } = req.body;

  if (!statusId || !viewer) {
    return res.status(400).json({ message: "Missing data" });
  }

  if (!statusViews[statusId]) {
    statusViews[statusId] = [];
  }

  const alreadySeen = statusViews[statusId].find(
    (v) => v.user === viewer
  );

  if (!alreadySeen) {
    statusViews[statusId].push({
      user: viewer,
      seenAt: Date.now(),
    });
  }

  res.json({
    count: statusViews[statusId].length,
    users: statusViews[statusId],
  });
});


app.get("/status/views/:statusId", (req, res) => {
  const { statusId } = req.params;

  res.json({
    count: statusViews[statusId]?.length || 0,
    users: statusViews[statusId] || [],
  });
});

app.post("/delete-status", (req, res) => {
  const { id } = req.body;

  const before = statusList.length;

  statusList = statusList.filter((s) => s.id.toString() !== id.toString());

  delete statusViews[id];

  const after = statusList.length;

  if (before === after) {
    return res.status(404).json({ message: "Status Not Found" });
  }

  res.json({ message: "Deleted Successfully" });
});

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

    const cleanUser = userName.trim();      // newly add
    socket.userName = cleanUser;
    socket.join(cleanUser);

    userStatus[cleanUser] = {
      online: true,
      lastSeen: getIndiaTime(),
    };

    io.emit("statusUpdate", { user: cleanUser, ...userStatus[cleanUser] });
  });

  socket.on("userActive", (userName) => {
    if (!userName) return;

    const cleanUser = userName.trim();      // newly add
    userStatus[cleanUser] = {
      online: true,
      lastSeen: getIndiaTime(),
    };

    io.emit("statusUpdate", { user: cleanUser, ...userStatus[cleanUser] });
  });

  socket.on("joinRoom", ({ user1, user2 }) => {
    if (!user1 || !user2) return;

    const room = [user1.trim(), user2.trim()].sort().join("_");
    socket.join(room);
  });

  socket.on("sendMessage", (msg) => {
    const { sender, receiver } = msg;
  
    if (!sender || !receiver) return;
  
    const room = [sender.trim(), receiver.trim()].sort().join("_");
  
    // Prevent duplicate precaution
    if (msg.__processed) return;
    msg.__processed = true;
  
    io.to(room).emit("receiveMessage", {
      ...msg,
      time: getIndiaTime(),
    });
  
    // sender ko sent confirm
    socket.emit("messageSentConfirm", {
      id: msg.id,
      status: "sent",
      receiver: receiver.trim(),
    });
  
    // ⭐ NEW – AUTO DELIVERED STATUS
    io.to(receiver.trim()).emit("updateMessageStatus", {
      id: msg.id,
      status: "delivered",
    });
  });
  
  socket.on("messageDelivered", ({ id, sender, receiver }) => {
    if (!id || !sender || !receiver) return;
  
    io.to(sender.trim()).emit("updateMessageStatus", {
      id,
      status: "delivered",
      sender: sender.trim(),
      receiver: receiver.trim(),
    });
  });
  

  socket.on("chatOpened", ({ opener, partner }) => {
    if (!partner) return;                 // newly add - better logic

    const room = [opener.trim(), partner.trim()].sort().join("_");

    io.to(room).emit("updateAllSeen", {
      opener: opener.trim(),              // update
      partner: partner.trim(),            // update
    });
  });

  // 🟢 Newly Add - instant seen when chat already open on both devices
  socket.on("chatScreenFocused", ({ user, partner }) => {
    if (!user || !partner) return;

    const room = [user.trim(), partner.trim()].sort().join("_");

    io.to(room).emit("updateAllSeen", {
      opener: user.trim(),
      partner: partner.trim(),
    });
  });

  socket.on("typing", ({ to, typing }) => {
    if (!to) return;                      // safety add
    io.to(to.trim()).emit("typing", { typing });
  });

  socket.on("userInactive", (userName) => {
    if (!userName) return;

    const cleanUser = userName.trim();    // newly add

    userStatus[cleanUser] = {
      online: false,
      lastSeen: getIndiaTime(),
    };

    io.emit("statusUpdate", {
      user: cleanUser,
      ...userStatus[cleanUser],
    });
  });

  socket.on("disconnect", () => {
    if (!socket.userName) return;

    const cleanUser = socket.userName.trim();   // newly add

    userStatus[cleanUser] = {
      online: false,
      lastSeen: getIndiaTime(),
    };

    io.emit("statusUpdate", {
      user: cleanUser,
      ...userStatus[cleanUser],
    });

    console.log("❌ Disconnected:", socket.id);
  });
});


/* ⭐⭐⭐ START SERVER ⭐⭐⭐ */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running @ ${PORT}`));
