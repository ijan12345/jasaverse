import OtpVerification from "../models/otp.model.js";
import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import { sendEmailOtp} from "../utils/sendOtp.js"; // nanti kita buat
import crypto from "crypto";
import bcrypt from "bcrypt";
import axios from "axios";
import Blacklist from "../models/blacklist.model.js";


export const sendOtp = async (req, res, next) => {
  try {
    const { email, phone, userData, type = "email" } = req.body; // default ke 'email' jika tidak dikirim

    // ✅ Hanya validasi blacklist jika type === "email" (registrasi)
    if (type === "email") {
      const isBlacklisted = await Blacklist.findOne({ email });
      if (isBlacklisted) {
        return res.status(403).json({ message: "Email ini diblokir oleh sistem." });
      }

      // Cek apakah email sudah digunakan
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: "Email sudah digunakan." });
      }
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Simpan OTP dan userData hanya untuk registrasi
    const updateData = { code: otpCode, expiresAt };
    if (type === "email" && userData) {
      updateData.userData = userData;
    }

    await OtpVerification.findOneAndUpdate(
      { email, type },
      updateData,
      { upsert: true, new: true }
    );

    await sendEmailOtp(email, otpCode);

    res.status(200).json({ message: "OTP dikirim" }); // Hapus OTP dari response untuk production
  } catch (err) {
    next(err);
  }
};


export const verifyOtp = async (req, res, next) => {
  try {
    const { email, emailOtp, type = "email" } = req.body;

    const otpRecord = await OtpVerification.findOne({ email, type });

    if (!otpRecord) {
      return res.status(400).json({ message: "Tidak ditemukan OTP untuk email ini." });
    }

    if (otpRecord.code !== emailOtp) {
      return res.status(400).json({ message: "OTP tidak valid" });
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP kadaluarsa" });
    }

    if (type === "recovery") {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "Akun tidak ditemukan" });
      }

      return res.status(200).json({
        message: "OTP valid",
        username: user.username,
        email: user.email,
      });
    }

    // --- VERIFIKASI ULANG EMAIL ---
    if (type === "verify") {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      user.emailVerified = true;
      user.lastVerifiedAt = new Date();
      await user.save();

      await OtpVerification.deleteOne({ _id: otpRecord._id });

      return res.status(200).json({ message: "Email berhasil diverifikasi ulang" });
    }

    // --- REGISTRASI ---
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Akun sudah dibuat sebelumnya." });
    }

    const userData = otpRecord.userData;
    if (!userData) {
      return res.status(400).json({ message: "Data registrasi tidak ditemukan." });
    }

    userData.password = bcrypt.hashSync(userData.password, 10);
    userData.emailVerified = true;
    userData.lastVerifiedAt = new Date();

    const newUser = new User(userData);
    await newUser.save();

    await OtpVerification.deleteOne({ _id: otpRecord._id });

    res.status(201).json({
      message: "Registrasi berhasil",
      username: newUser.username,
    });
  } catch (err) {
    next(err);
  }
};


