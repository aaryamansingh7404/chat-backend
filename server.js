import dotenv from "dotenv";
dotenv.config(); // Load env first

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { authMiddleware } from "./middleware/authMiddleware.js";

const app = express();
app.use(express.json());
app.use(cors());

// 🌐 DB Connect
connectDB();

// 🛣 Routes
app.use("/api/auth", authRoutes);

// 🏠 Test Route
app.get("/", (req, res) => res.send("API Running... 🚀"));

// 🔐 Protected Route
app.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Protected Route Accessed 🔐",
    user: req.user,
  });
});

// 🎯 PORT FIX
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 REST API running on ${PORT}`));
