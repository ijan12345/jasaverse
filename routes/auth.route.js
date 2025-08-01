import express from "express";
import { register, login, logout, resendOtp, resetPassword } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/reset-password", resetPassword);
router.post("/resend-otp", resendOtp);
router.post("/logout", logout);

export default router;
