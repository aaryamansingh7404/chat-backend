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
const userStatus = {}; 
// { username : {online:true/false, lastSeen:"time"} }

io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  socket.on("initUser", ({ userName }) => {
    if (!userName) return;
    socket.userName = userName.trim();
    socket.join(socket.userName);

    userStatus[userName] = {
      online: true,
      lastSeen: "now",
    };

    io.emit("statusUpdate", { user: userName, ...userStatus[userName] });
  });

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
