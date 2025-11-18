import express from "express";
import { verifyToken } from "../middleware/jwt.js";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import {
  getAdminDashboard,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAllGigs,
   getOrderOverviewStats,
  getAdminFee,
  getGigById,
  updateGig,
  deleteGig,
} from "../controllers/admin.controller.js";
// Import dari order controller jika belum


const router = express.Router();

// =============================
// 1️⃣ Dashboard Admin
// =============================
router.get("/dashboard", verifyToken, verifyAdmin, getAdminDashboard);

// =============================
// 2️⃣ Manajemen Pengguna
// =============================
router.get("/users", verifyToken, verifyAdmin, getAllUsers);
router.get("/users/:id", verifyToken, verifyAdmin, getUserById);
router.put("/users/:id", verifyToken, verifyAdmin, updateUser);
router.delete("/users/:id", verifyToken, verifyAdmin, deleteUser);




// =============================
// 3️⃣ Manajemen Gigs
// =============================
router.get("/gigs", verifyToken, verifyAdmin, getAllGigs); // Ambil semua gigs
router.get("/gigs/:userId", verifyToken, verifyAdmin, getGigById); // Ambil gig berdasarkan ID
router.put("/gigs/:userId", verifyToken, verifyAdmin, updateGig); // Update gig
router.delete("/gigs/:userId", verifyToken, verifyAdmin, deleteGig); // Hapus gig


router.get("/order-overview-stats", verifyToken, verifyAdmin, getOrderOverviewStats);
router.get("/admin-fee", verifyToken, verifyAdmin, getAdminFee);


export default router;
