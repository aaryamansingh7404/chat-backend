import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("🔥 USER CONNECTED:", socket.id);

  socket.on("joinRoom", ({ roomId, userName }) => {
    socket.join(roomId);
    console.log(`📌 ${userName} joined ${roomId}`);

    socket.to(roomId).emit("userJoined", userName);
  });

  // SEND
  socket.on("sendMessage", ({ roomId, message }) => {
    io.to(roomId).emit("receiveMessage", message);
  });

  // DELIVERED
  socket.on("messageDelivered", ({ roomId, messageId }) => {
    io.to(roomId).emit("updateMessageStatus", {
      id: messageId,
      status: "delivered",
    });
  });

  // SEEN (ONLY WHEN CHAT IS OPEN)
  socket.on("chatOpened", ({ roomId, userName }) => {
    console.log(`💙 ${userName} opened chat ${roomId}`);

    io.to(roomId).emit("updateAllSeen", {
      status: "seen",
      seenBy: userName,
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ USER DISCONNECTED:", socket.id);
  });
});

server.listen(5000, () => console.log("⚡ Server Live on 5000"));
