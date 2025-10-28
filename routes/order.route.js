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
  sendDeliveryEmail,
  rejectOrder,
  getDisputedOrders,
  resolveDispute,
  reportDispute,
  respondDispute,
  deleteOrderByAdmin,
  getAdminRevenue,
  deleteConversationsWithCompletedOrCanceledOrder,
  requestRevisionUse, respondRevisionUse,
  handleXenditWebhook, // ✅ Tambahkan webhook Xendit
} from "../controllers/order.controller.js";

const router = express.Router();

// 📌 UTAMA
router.post("/payment-intent", verifyToken, intent);
router.post("/payment-intent/:id", verifyToken, intent); // opsional jika ada multiple intent
router.post("/xendit-webhook", express.json({ type: "application/json" }), handleXenditWebhook); // ✅ WEBHOOK BARU
router.post("/:id/send-email", verifyToken, sendDeliveryEmail);

// 📌 ADMIN
router.get("/admin/stats", verifyToken, verifyAdmin, getOrderStats);
router.get("/admin/disputes", verifyToken, verifyAdmin, getDisputedOrders);
router.post("/admin/disputes/:id/resolve", verifyToken, verifyAdmin, resolveDispute);
router.get("/admin/pending-releases", verifyToken, verifyAdmin, getPendingReleases);
router.delete("/admin/:id", verifyToken, verifyAdmin, deleteOrderByAdmin);
router.get("/admin/revenue", verifyToken, verifyAdmin, getAdminRevenue);
// 📌 PENGHASILAN
router.get("/earnings/:userId", verifyToken, getEarnings); // GANTI dari /midtrans/earnings

router.put("/:id/request-revision", verifyToken, requestRevisionUse);
router.put("/:id/respond-revision", verifyToken, respondRevisionUse);


router.get("/payment-success", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Pembayaran Berhasil</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f9fff9;
            color: #1DBF73;
            text-align: center;
          }
          h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
          }
          p {
            font-size: 1.2rem;
            color: #444;
          }
          .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="icon">✅</div>
        <h1>Pembayaran Berhasil</h1>
        <p>Anda dapat kembali ke aplikasi SkillSap.</p>
        <script>
          setTimeout(() => window.location.href = "skillsap://orders", 1500);
        </script>
      </body>
    </html>
  `);
});

router.get("/payment-failure", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Pembayaran Gagal</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #fff8f8;
            color: #C0392B;
            text-align: center;
          }
          h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
          }
          p {
            font-size: 1.2rem;
            color: #444;
          }
          .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="icon">❌</div>
        <h1>Pembayaran Gagal</h1>
        <p>Silakan kembali ke aplikasi SkillSap dan coba lagi.</p>
        <script>
          setTimeout(() => window.location.href = "skillsap://orders", 1500);
        </script>
      </body>
    </html>
  `);
});

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
