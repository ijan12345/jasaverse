import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/jwt.js";
import mongoose from "mongoose";
import { 
  getOrders, 
  intent, 
  getEarnings, 
  deleteOrder, 
  completeOrder,
  getOrderReceipt,
  getPendingReleases,
  getOrderStats,
  acceptOrder,
  updateProgressStatus,
  addExtraRequest,
  handleExtraPayment,
  rejectExtraRequest,
  rejectOrder,
  getDisputedOrders,
  resolveDispute,
  reportDispute,
  respondDispute,
  deleteOrderByAdmin,
  getAdminRevenue,
  deleteConversationsWithCompletedOrCanceledOrder,
  handleXenditWebhook, // ✅ Tambahkan webhook Xendit
} from "../controllers/order.controller.js";

const router = express.Router();

// 📌 UTAMA
router.post("/payment-intent", verifyToken, intent);
router.post("/payment-intent/:id", verifyToken, intent); // opsional jika ada multiple intent
router.post("/xendit-webhook", express.json({ type: "application/json" }), handleXenditWebhook); // ✅ WEBHOOK BARU

// 📌 ADMIN
router.get("/admin/stats", verifyToken, verifyAdmin, getOrderStats);
router.get("/admin/disputes", verifyToken, verifyAdmin, getDisputedOrders);
router.post("/admin/disputes/:id/resolve", verifyToken, verifyAdmin, resolveDispute);
router.get("/admin/pending-releases", verifyToken, verifyAdmin, getPendingReleases);
router.delete("/admin/:id", verifyToken, verifyAdmin, deleteOrderByAdmin);
router.get("/admin/revenue", verifyToken, verifyAdmin, getAdminRevenue);
// 📌 PENGHASILAN
router.get("/earnings/:userId", verifyToken, getEarnings); // GANTI dari /midtrans/earnings

// 📌 ORDER DAN EXTRA
router.get("/", verifyToken, getOrders);
router.get("/:id", verifyToken, getOrders);
router.get("/:id/receipt", verifyToken, getOrderReceipt);
router.post("/:id/extra-payment", verifyToken, handleExtraPayment);
router.put("/:id/extra-request", verifyToken, addExtraRequest);
router.delete("/auto-delete-completed", verifyToken, deleteConversationsWithCompletedOrCanceledOrder);
router.put("/:id/reject-extra-request", verifyToken, rejectExtraRequest);
router.put("/:id/progress", verifyToken, updateProgressStatus);
router.put("/:id/accept", verifyToken, acceptOrder);
router.put("/:id/complete", verifyToken, completeOrder);
router.put("/:id/reject", verifyToken, rejectOrder);
router.put("/:id/report", verifyToken, reportDispute);
router.put("/:id/respond", verifyToken, respondDispute);
router.delete("/:id", verifyToken, deleteOrder);

export default router;
