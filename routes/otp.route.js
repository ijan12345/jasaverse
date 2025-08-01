import express from "express";
import { sendOtp, verifyOtp } from "../controllers/otp.controller.js";

const router = express.Router();

router.post("/send-otp", sendOtp);      // Kirim OTP ke email dan/atau phone
router.post("/verify-otp", verifyOtp);  // Verifikasi OTP yang dikirim user

export default router;
