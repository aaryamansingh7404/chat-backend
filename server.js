import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("🔥 USER CONNECTED:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log("📌 User joined:", roomId);
  });

  // ✍️ Typing Indicator
  socket.on("typingState", ({ roomId, userName, typing }) => {
    socket.to(roomId).emit("typingState", { userName, typing });
  });

  // 📩 Message Send
  socket.on("sendMessage", ({ roomId, message }) => {
    io.to(roomId).emit("receiveMessage", message);
  });

  // ✔️ Delivered (double tick)
  socket.on("messageDelivered", ({ roomId, messageId }) => {
    io.to(roomId).emit("updateMessageStatus", {
      id: messageId,
      status: "delivered",
    });
  });

  // 👀 Seen (blue tick)
  socket.on("seenMessages", ({ roomId }) => {
    io.to(roomId).emit("updateAllSeen");
  });

  socket.on("disconnect", () => {
    console.log("❌ USER DISCONNECTED:", socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
