import express from "express";
import User from "../models/user.model.js";
import { deleteUser, getSellerScores, getUser, saveUserImages, getUserImages, getUserProfile, getUserRank, updateBalance,
  withdrawBalance, } from "../controllers/user.controller.js";
import { verifyToken, verifyAdmin  } from "../middleware/jwt.js";

const router = express.Router();

router.get("/admin/balance", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const admin = await User.findOne({ role: "admin" }).select("balance");
    if (!admin) return res.status(404).json({ message: "Admin tidak ditemukan" });

    res.status(200).json({ balance: admin.balance || 0 });
  } catch (err) {
    console.error("Gagal ambil saldo admin:", err);
    res.status(500).json({ message: "Terjadi kesalahan saat mengambil saldo admin" });
  }
});

router.get("/userProfile/:id", getUserProfile); 

router.delete("/:id", verifyToken, deleteUser);
router.get("/:id/rank", getUserRank);
router.get("/:id/score", getSellerScores);
router.put("/:id/images", saveUserImages);
router.get("/:id/images", getUserImages);
router.put("/balance", verifyToken, verifyAdmin, updateBalance); // Admin mengatur saldo
router.post("/balance/withdraw", verifyToken, withdrawBalance);  // Seller/admin tarik saldo
// GET /users/:id/balance
router.get("/:id/balance", verifyToken, async (req, res) => {

  try {
    const user = await User.findById(req.params.id).select("balance");
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    res.status(200).json({ balance: user.balance || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil saldo user" });
  }
});

// ✅ GET saldo admin langsung berdasarkan role (bukan dari :id)

router.get("/:id", getUser);

export default router;
