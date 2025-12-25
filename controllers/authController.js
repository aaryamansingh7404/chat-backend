import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// 📌 REGISTER
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

    res.status(201).json({ message: "Account created successfully 🎉" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


// 📌 LOGIN
export const login = async (req, res) => {
  try {
    console.log("📥 Login Request:", req.body);

    const { email, password } = req.body;
    if (!email || !password) {
      console.log("❌ Missing Fields");
      return res.status(400).json({ message: "Email & password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found");
      return res.status(400).json({ message: "User not found ❌" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log("❌ Wrong password");
      return res.status(400).json({ message: "Incorrect password ❌" });
    }

    console.log("🔑 JWT SECRET:", process.env.JWT_SECRET); // 👈 CHECK THIS!!!
    
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "1d" }
    );

    res.json({ message: "Login successful 🎉", token });
    
  } catch (err) {
    console.log("🔥 SERVER LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

