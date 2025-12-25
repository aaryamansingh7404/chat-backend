import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ⭐ REGISTER
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const hashedPass = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashedPass });

    return res.status(201).json({ message: "Account created successfully 🎉" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};


// ⭐ DUMMY LOGIN (TEMP)
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const D_EMAIL = "admin@test.com";
  const D_PASS = "123456";

  // ⭐ Dummy Login Allow
  if (email === D_EMAIL && password === D_PASS) {
    return res.json({
      success: true,
      message: "Dummy Login Successful 🎉",
      token: "dummy-token-123",
      user: { name: "ASR", email: D_EMAIL },
    });
  }

  // ❌ Otherwise reject
  return res.status(401).json({
    success: false,
    message: "Invalid Dummy Credentials ❌",
  });
};
