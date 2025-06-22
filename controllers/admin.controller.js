import User from "../models/user.model.js";
import Gig from "../models/gig.model.js";
import createError from "../utils/createError.js";
import Order from "../models/order.model.js";
import Message from "../models/message.model.js";
import Review from "../models/review.model.js";
import Conversation from "../models/conversation.model.js";
import Seller from "../models/seller.model.js";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});


// =============================
// 1️⃣ Admin Dashboard (Ringkasan Data)
// =============================
export const getAdminDashboard = async (req, res, next) => {
  try {
    // Hitung data pengguna dan gigs
    const totalUsers = await User.countDocuments();
    const totalSellers = await User.countDocuments({ role: "seller" });
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalGigs = await Gig.countDocuments();

    // Ambil semua order yang status-nya "pending" atau "completed"
    const orders = await Order.find({ status: { $in: ["pending", "completed"] } });

    // Hitung total admin fee (gunakan field adminFee jika ada, fallback ke 2% dari harga)
    const totalAdminFee = orders.reduce((sum, order) => {
      const fee = order.adminFee > 0 ? order.adminFee : order.price * 0.02;
      return sum + fee;
    }, 0);

    // Kirim semua data ke response
    res.status(200).json({
      message: "Admin Dashboard Data",
      totalUsers,
      totalSellers,
      totalAdmins,
      totalGigs,
      totalAdminFee: Math.round(totalAdminFee * 100) / 100, // dibulatkan 2 angka desimal
    });
  } catch (err) {
    next(err);
  }
};


// =============================
// 2️⃣ Get All Users (Manajemen User)
// =============================
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}, "-password");
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};

// =============================
// 3️⃣ Get User By ID (Detail User)
// =============================
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id, "-password");
    if (!user) return next(createError(404, "User not found!"));

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

// =============================
// 4️⃣ Update User (Edit User)
// =============================
export const updateUser = async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedUser);
  } catch (err) {
    next(err);
  }
};

// =============================
// 5️⃣ Delete User (Hapus User)
// =============================
export const deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return next(createError(404, "User tidak ditemukan"));

    // 1️⃣ Hapus file Cloudinary milik user
    const cloudinaryIds = [
      user.profilePublicId,
      user.cvPublicId,
      user.certificatePublicId,
    ].filter(Boolean); // hanya yang ada saja

    for (const publicId of cloudinaryIds) {
      await cloudinary.uploader.destroy(publicId);
    }

    // 2️⃣ Hapus gambar gigs dari Cloudinary
    const userGigs = await Gig.find({ userId });
    for (const gig of userGigs) {
      if (gig.coverPublicId) {
        await cloudinary.uploader.destroy(gig.coverPublicId);
      }
      if (gig.imagePublicIds && Array.isArray(gig.imagePublicIds)) {
        for (const imgId of gig.imagePublicIds) {
          await cloudinary.uploader.destroy(imgId);
        }
      }
    }

    // 3️⃣ Hapus semua data terkait user
    await Promise.all([
      Gig.deleteMany({ userId }),
      Order.deleteMany({ $or: [{ buyerId: userId }, { sellerId: userId }] }),
      Message.deleteMany({ $or: [{ userId: userId.toString() }, { members: userId }] }),
      Review.deleteMany({ userId }),
      Seller.deleteOne({ userId }),
      Conversation.deleteMany({ $or: [{ sellerId: userId }, { buyerId: userId }] }),
      User.findByIdAndDelete(userId),
    ]);

    res.status(200).json({ message: "User dan semua datanya berhasil dihapus (termasuk file Cloudinary)." });
  } catch (err) {
    next(err);
  }
};

// =============================
// 6️⃣ Get All Gigs (Manajemen Gigs)
// =============================
export const getAllGigs = async (req, res, next) => {
  try {
    const userId = req.params.userId; // Ambil userId dari parameter URL

    // Validasi apakah userId dikirim
    if (!userId) {
      return next(createError(400, "User ID is required"));
    }

    const gigs = await Gig.find({ userId }).populate("userId", "username email");

    if (!gigs || gigs.length === 0) {
      return next(createError(404, "No gigs found for this user"));
    }

    res.status(200).json(gigs);
  } catch (err) {
    next(err);
  }
};
// =============================
// 7️⃣ Get Gig By ID (Detail Gig)
// =============================
export const getGigById = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    // Cari gig berdasarkan ID dan userId
    const gig = await Gig.findOne({ _id: id, userId }).populate("userId", "username email");

    if (!gig) {
      return next(createError(404, "Gig not found or doesn't belong to this user"));
    }

    res.status(200).json(gig);
  } catch (err) {
    next(err);
  }
};
// =============================
// 8️⃣ Update Gig (Edit Gig)
// =============================
export const updateGig = async (req, res, next) => {
  try {
    const updatedGig = await Gig.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedGig);
  } catch (err) {
    next(err);
  }
};

// =============================
// 9️⃣ Delete Gig (Hapus Gig)
// =============================
export const deleteGig = async (req, res, next) => {
  try {
    await Gig.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Gig deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// =============================
// 🔟 Promote User to Admin
// =============================
export const promoteToAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    user.role = "admin";
    await user.save();

    res.status(200).json({ message: "User promoted to admin", user });
  } catch (err) {
    next(err);
  }
};

// =============================
// 1️⃣1️⃣ Demote Admin to User
// =============================
export const demoteAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    user.role = "buyer"; // Kembali jadi user biasa
    await user.save();

    res.status(200).json({ message: "Admin demoted to user", user });
  } catch (err) {
    next(err);
  }
};

