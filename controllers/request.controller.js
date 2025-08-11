import Request from "../models/request.model.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import cloudinary from "../utils/cloudinary.js";
import createError from "../utils/createError.js";

// Membuat Request (tetap, tidak berubah)
export const createRequest = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) return next(createError(401, "Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const userId = decoded.id;

    const { title, desc, budget, deliveryTime, cover, coverPublicId } = req.body;

    const newRequest = new Request({
      title,
      desc,
      budget,
      deliveryTime,
      cover,
      coverPublicId,
      userId: new mongoose.Types.ObjectId(userId),
    });

    const saved = await newRequest.save();
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
};

// Menghapus Request (tetap, tidak berubah)
export const deleteRequest = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) return next(createError(401, "Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const userId = decoded.id;
    const role = decoded.role || "buyer";

    const request = await Request.findById(req.params.id);
    if (!request) return next(createError(404, "Request not found"));

    if (request.userId.toString() !== userId && role !== "admin") {
      return next(createError(403, "Not authorized to delete this request"));
    }

    if (request.coverPublicId) {
      await cloudinary.uploader.destroy(request.coverPublicId);
    }

    await Request.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Request deleted" });
  } catch (err) {
    next(err);
  }
};

// Mendapatkan semua Request
export const getAllRequests = async (req, res, next) => {
  try {
    // Hitung batas waktu 15 hari yang lalu
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    // Ambil hanya request yang belum expired
    const requests = await Request.find({ createdAt: { $gte: fifteenDaysAgo } })
      .populate("userId", "_id username");

    // Hapus request yang sudah expired
    const expiredRequests = await Request.find({ createdAt: { $lt: fifteenDaysAgo } });
    for (const request of expiredRequests) {
      if (request.coverPublicId) {
        await cloudinary.uploader.destroy(request.coverPublicId);
      }
    }
    await Request.deleteMany({ createdAt: { $lt: fifteenDaysAgo } });

    res.status(200).json(requests);
  } catch (err) {
    console.error("Error getAllRequests:", err);
    next(err);
  }
};

// Mendapatkan semua Request milik user (buyer)
export const getRequests = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) return next(createError(401, "Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const userId = decoded.id;

    // Hitung batas waktu 15 hari yang lalu
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    // Ambil hanya request yang belum expired
    const requests = await Request.find({ userId, createdAt: { $gte: fifteenDaysAgo } });

    // Hapus request yang sudah expired untuk user ini
    const expiredRequests = await Request.find({ userId, createdAt: { $lt: fifteenDaysAgo } });
    for (const request of expiredRequests) {
      if (request.coverPublicId) {
        await cloudinary.uploader.destroy(request.coverPublicId);
      }
    }
    await Request.deleteMany({ userId, createdAt: { $lt: fifteenDaysAgo } });

    res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
};

// Mendapatkan satu Request berdasarkan ID
export const getRequestById = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return next(createError(404, "Request not found"));

    // Cek apakah request sudah expired
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    if (new Date(request.createdAt) < fifteenDaysAgo) {
      if (request.coverPublicId) {
        await cloudinary.uploader.destroy(request.coverPublicId);
      }
      await Request.findByIdAndDelete(req.params.id);
      return next(createError(404, "Request expired and deleted"));
    }

    res.status(200).json(request);
  } catch (err) {
    next(err);
  }
};