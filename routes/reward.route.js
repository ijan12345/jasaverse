import express from "express";
import { redeemReward, getPendingRewards, approveReward, rejectReward, getUserRedemptions } from "../controllers/reward.controller.js";
import { verifyToken, verifyAdmin } from "../middleware/jwt.js";

const router = express.Router();

router.post("/redeem", verifyToken, redeemReward);

// 🔹 Admin only routes
router.get("/my-redemptions", verifyToken, getUserRedemptions);
router.get("/admin/pending", verifyToken, verifyAdmin, getPendingRewards);
router.patch("/admin/:id/approve", verifyToken, verifyAdmin, approveReward);
router.patch("/admin/:id/reject", verifyToken, verifyAdmin, rejectReward);

export default router;
