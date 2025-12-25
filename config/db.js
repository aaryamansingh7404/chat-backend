import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // Load env file

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "chatapp",
    });
    console.log("🍃 MongoDB Connected Successfully 🚀");
  } catch (error) {
    console.log("❌ MongoDB Error:", error.message);
  }
};
