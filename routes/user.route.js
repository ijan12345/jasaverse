import express from "express";
import User from "../models/user.model.js";
import { deleteUser,getSellerLevelInfo, getSellerLeaderboard, getSellerScores, getUser, saveUserImages, getUserImages, getUserProfile, getUserRank, updateBalance,changeEmail,
  withdrawBalance,getUserBalance,getUserProfileFromToken, getFacultyRanks, changePhone, getBlacklistedEmails, checkUsername, addEmailToBlacklist, removeEmailFromBlacklist } from "../controllers/user.controller.js";
import { verifyToken, verifyAdmin  } from "../middleware/jwt.js";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import { uploader } from "cloudinary";
import streamifier from "streamifier";


const storage = multer.memoryStorage(); // atau diskStorage jika simpan ke filesystem
const upload = multer({ storage });

const router = express.Router();

router.get("/admin/balance", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const admin = await User.findOne({ role: "admin" }).select("availableBalance pendingBalance");
    
    if (!admin) {
      return res.status(404).json({ message: "Admin tidak ditemukan" });
    }

    res.status(200).json({
      availableBalance: admin.availableBalance || 0,
      pendingBalance: admin.pendingBalance || 0,
    });
  } catch (err) {
    console.error("Gagal ambil saldo admin:", err);
    res.status(500).json({ message: "Terjadi kesalahan saat mengambil saldo admin" });
  }
});

router.get("/me", verifyToken, getUserProfileFromToken);
router.get("/:id/balance", verifyToken, getUserBalance);
router.get("/:id/level-info", verifyToken, getSellerLevelInfo);
router.get("/userProfile/:id", getUserProfile); 
// 🧹 Endpoint untuk hapus gambar dari Cloudinary
router.post("/cloudinary/delete", verifyToken, async (req, res) => {
  const { public_id } = req.body;

  if (!public_id) {
    return res.status(400).json({ message: "public_id dibutuhkan" });
  }

  try {
    const result = await uploader.destroy(public_id);
    if (result.result !== "ok") {
      return res.status(500).json({ message: "Gagal menghapus gambar" });
    }
    res.status(200).json({ message: "Berhasil dihapus" });
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    res.status(500).json({ message: "Gagal saat menghapus gambar" });
  }
});
router.put("/:id", verifyToken, upload.single("img"), async (req, res) => {
  try {
    const { desc } = req.body;
    const updateData = { desc };




    if (req.file) {
  // Ambil user lama dulu untuk akses imgPublicId sebelumnya
  const oldUser = await User.findById(req.params.id);

  // Jika ada gambar lama, hapus dulu dari Cloudinary
  if (oldUser?.imgPublicId) {
    try {
      await cloudinary.uploader.destroy(oldUser.imgPublicId);
    } catch (err) {
      console.warn("Gagal hapus gambar lama dari Cloudinary:", err.message);
    }
  }

  // Upload gambar baru ke Cloudinary
  const streamUpload = (buffer) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream((error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      });
      streamifier.createReadStream(buffer).pipe(stream);
    });
  };

  const result = await streamUpload(req.file.buffer);
  updateData.img = result.secure_url;
  updateData.imgPublicId = result.public_id;
}

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.status(200).json(updatedUser);
  } catch (err) {
    console.error("Gagal update profil:", err);
    res.status(500).json({ message: "Gagal update profil" });
  }
});

router.delete("/:id", verifyToken, deleteUser);
router.get("/:id/rank", getUserRank);
router.get("/:id/score", getSellerScores);
router.put("/:id/images", saveUserImages);
// 🔹 Endpoint ranking fakultas
router.get("/sellers/leaderboard", getSellerLeaderboard);
router.get("/faculty-rank", getFacultyRanks);
router.get("/admin/blacklisted-emails", verifyToken, verifyAdmin, getBlacklistedEmails);
router.post("/admin/blacklist-email", verifyToken, verifyAdmin, addEmailToBlacklist);
router.delete("/admin/blacklist-email/:email", verifyToken, verifyAdmin, removeEmailFromBlacklist);
router.put("/:id/change-email", verifyToken, changeEmail);
router.get("/:id/images", getUserImages);
router.get("/check-username/:username", checkUsername);
router.put("/:id/change-phone", verifyToken, changePhone);
router.put("/balance", verifyToken, verifyAdmin, updateBalance); // Admin mengatur saldo
router.post("/balance/withdraw", verifyToken, withdrawBalance);  // Seller/admin tarik saldo
// GET /users/:id/balance



router.get("/:id", getUser);

export default router;
