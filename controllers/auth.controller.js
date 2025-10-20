import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import OtpVerification from "../models/otp.model.js";
import crypto from "crypto";
import { sendEmailOtp } from "../utils/sendOtp.js";
import createError from "../utils/createError.js";



export const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return next(createError(404, "User tidak ditemukan"));

    const newOtp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Ganti kode OTP jika sudah ada, atau buat baru
    await OtpVerification.findOneAndUpdate(
      { userId: user._id, type: "email" },
      { code: newOtp, expiresAt },
      { upsert: true, new: true }
    );

    // Kirim ulang ke email
    await sendEmailOtp(user.email, newOtp);

    res.status(200).json({
      message: "OTP berhasil dikirim ulang ke email",
      otp: newOtp, // 🔧 hanya untuk testing
    });
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const { username, email, password, phone } = req.body;

    // 🔒 Cek duplikat
    const existingUsername = await User.findOne({ username });
    if (existingUsername) return next(createError(400, "Username sudah digunakan"));

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return next(createError(400, "Email sudah terdaftar"));

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) return next(createError(400, "Nomor telepon sudah digunakan"));

    // 🔒 Cek blacklist
    if (User.isEmailBlacklisted(email)) {
      return res.status(403).json({
        message: "Email ini diblokir oleh sistem. Silakan gunakan email lain.",
      });
    }

    // 🔑 Enkripsi password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Role logic
    const isSeller = req.body.role === "seller" || req.body.isSeller === true;
    const role = isSeller ? "seller" : "buyer";

    // 🚀 Simpan field eksplisit
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      phone: req.body.phone,
      address: req.body.address,
      desc: req.body.desc,

      img: req.body.img,
      imgPublicId: req.body.imgPublicId,

      nimImage: req.body.nimImage,
      nimPublicId: req.body.nimPublicId,
      faculty: req.body.faculty,

      cvImage: req.body.cvImage,
      cvPublicId: req.body.cvPublicId,

      // 🔹 Field baru (PKKMB & LDKM)
      certificatePKKMB: req.body.certificatePKKMB,
      certificatePKKMBPublicId: req.body.certificatePKKMBPublicId,
      certificateLDKM: req.body.certificateLDKM,
      certificateLDKMPublicId: req.body.certificateLDKMPublicId,

      role,
      isSeller,
      emailVerified: false,
    });

    await newUser.save();
    res.status(201).send("Akun berhasil dibuat");
  } catch (err) {
    if (err.name === "ValidationError") {
      return next(createError(400, "Data tidak valid"));
    }
    next(err);
  }
};


export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return next(createError(404, "Username atau password salah"));

    const isCorrect = bcrypt.compareSync(password, user.password);
    if (!isCorrect)
      return next(createError(400, "Username atau password salah"));

    // ✅ Reset emailVerified jika lebih dari 24 jam
    if (user.emailVerified && user.lastVerifiedAt) {
      const diff = Date.now() - new Date(user.lastVerifiedAt).getTime();
      const oneDay = 24 * 60 * 60 * 1000;

      if (diff > oneDay) {
        user.emailVerified = false;
        await user.save();
      }
    }

    const token = jwt.sign(
      {
        id: user._id,
        isSeller: user.isSeller,
        role: user.role,
      },
      process.env.JWT_KEY,
      { expiresIn: "7d" }
    );

    const { password: _, ...info } = user._doc;

    res
      .cookie("accessToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({ ...info, token });
  } catch (err) {
    next(err);
  }
};

// auth.controller.js
export const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    // 🔐 Validasi panjang password
    if (!newPassword || newPassword.length < 3 || newPassword.length > 15) {
      return res.status(400).json({
        message: "Password harus terdiri dari 3 hingga 15 karakter",
      });
    }

    // 🔐 Validasi konfirmasi password
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Konfirmasi password tidak cocok" });
    }

    const user = await User.findOne({ email });
    if (!user) return next(createError(404, "User tidak ditemukan"));

    // 🔐 Enkripsi password baru
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // 💾 Simpan ke database
    user.password = hashedPassword;
    await user.save(); // ❗ WAJIB

    res.status(200).json({ message: "Password berhasil diperbarui" });
  } catch (err) {
    next(err);
  }
};



export const logout = async (req, res) => {
  res
    .clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    })
    .status(200)
    .send("Berhasil logout");
};


