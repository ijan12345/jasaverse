// middleware/jwt.js
import jwt from "jsonwebtoken";
import createError from "../utils/createError.js";
import dotenv from "dotenv";
dotenv.config();

// ✅ Middleware untuk verifikasi token (semua user)
export const verifyToken = (req, res, next) => {
  let token =
    req.cookies.accessToken ||
    req.headers.authorization?.split(" ")[1]; // Cek di cookie atau header Authorization

  if (!token) {
    return next(createError(401, "Kamu belum login!"));
  }

  jwt.verify(token, process.env.JWT_KEY, (err, payload) => {
    if (err) {
      return next(createError(403, "Token tidak valid!"));
    }

    if (!payload || !payload.id || !payload.role) {
      return next(createError(403, "Payload token tidak lengkap!"));
    }

    req.userId = payload.id;
    req.isSeller = payload.isSeller || false;
    req.role = payload.role;

    next();
  });
};

// ✅ Middleware tambahan untuk validasi role admin
export const verifyAdmin = (req, res, next) => {
  if (req.role !== "admin") {
    return next(createError(403, "Akses hanya untuk admin"));
  }
  next();
};
