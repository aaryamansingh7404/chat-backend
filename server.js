import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { authMiddleware } from "./middleware/authMiddleware.js";

dotenv.config(); // Load .env 🔥

const app = express();
app.use(express.json());
app.use(cors());

// DB Connect
connectDB();

// Routes
app.use("/api/auth", authRoutes);


app.get("/", (req, res) => res.send("API Running... 🚀"));

app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Protected Route Accessed 🔐", user: req.user });
});
app.listen(process.env.PORT, () =>
  console.log(`🚀 REST API running on ${process.env.PORT}`)
);
