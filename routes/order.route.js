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
            margin: 0;
            height: 100vh;
            background: linear-gradient(135deg, #1DBF73 0%, #12a15f 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #fff;
            text-align: center;
          }

          .card {
            background: #fff;
            color: #333;
            border-radius: 20px;
            padding: 40px 50px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            max-width: 400px;
          }

          .icon {
            background-color: #1DBF73;
            color: white;
            border-radius: 50%;
            width: 90px;
            height: 90px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            margin: 0 auto 20px auto;
            box-shadow: 0 4px 12px rgba(29,191,115,0.4);
          }

          h1 {
            margin: 10px 0;
            font-size: 2rem;
            color: #1DBF73;
          }

          p {
            color: #666;
            font-size: 1rem;
          }

          .footer {
            margin-top: 25px;
            font-size: 0.9rem;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>Pembayaran Berhasil!</h1>
          <p>Terima kasih, transaksi Anda telah dikonfirmasi.</p>
          <p>Anda akan diarahkan kembali ke aplikasi SkillSap...</p>
          <div class="footer">SkillSap © 2025</div>
        </div>

        <script>
          setTimeout(() => window.location.href = "skillsap://orders", 2000);
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
            margin: 0;
            height: 100vh;
            background: linear-gradient(135deg, #F24444 0%, #C0392B 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #fff;
            text-align: center;
          }

          .card {
            background: #fff;
            color: #333;
            border-radius: 20px;
            padding: 40px 50px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            max-width: 400px;
          }

          .icon {
            background-color: #C0392B;
            color: white;
            border-radius: 50%;
            width: 90px;
            height: 90px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            margin: 0 auto 20px auto;
            box-shadow: 0 4px 12px rgba(192,57,43,0.4);
          }

          h1 {
            margin: 10px 0;
            font-size: 2rem;
            color: #C0392B;
          }

          p {
            color: #666;
            font-size: 1rem;
          }

          .footer {
            margin-top: 25px;
            font-size: 0.9rem;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">❌</div>
          <h1>Pembayaran Gagal!</h1>
          <p>Silakan kembali ke aplikasi SkillSap dan coba lagi.</p>
          <div class="footer">SkillSap © 2025</div>
        </div>

        <script>
          setTimeout(() => window.location.href = "skillsap://orders", 2000);
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
