import nodemailer from "nodemailer";
import dotenv from "dotenv";
import axios from "axios";
import qs from "qs";

dotenv.config(); // Untuk baca .env

export const sendEmailOtp = async (email, code) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Jasaverse" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Kode OTP Verifikasi Email",
    html: `<p>Berikut kode OTP verifikasi Anda:</p><h2>${code}</h2><p>Berlaku selama 5 menit.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email OTP berhasil dikirim ke ${email}`);
  } catch (err) {
    console.error("❌ Gagal kirim email OTP:", err);
  }
};

