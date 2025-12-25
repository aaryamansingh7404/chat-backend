import { register, loginUser } from "../controllers/authController.js";
import express from "express";
const router = express.Router();

router.post("/register", register);
router.post("/login", loginUser);

export default router;
