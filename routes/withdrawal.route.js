// routes/withdrawal.route.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/jwt.js";
import {
  requestWithdrawal,
  getMyWithdrawals,
  getAllWithdrawals,
  updateWithdrawalStatus,
} from "../controllers/withdrawal.controller.js";

const router = express.Router();

router.post("/", verifyToken, requestWithdrawal);
router.post("/admin", verifyToken, verifyAdmin, requestWithdrawal);
router.get("/my", verifyToken, getMyWithdrawals);
router.get("/", verifyToken, verifyAdmin, getAllWithdrawals);
router.put("/:id", verifyToken, verifyAdmin, updateWithdrawalStatus);

export default router;
