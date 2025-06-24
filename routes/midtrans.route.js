import express from "express";
import Order from "../models/order.model.js";

const router = express.Router();

// Endpoint untuk mengambil total earnings dari semua order milik seller
router.get("/:id", async (req, res) => {
  console.log("🔥 HIT /api/earnings/", req.params.id);
  const { id } = req.params;

  try {
    const allOrders = await Order.find({ sellerId: id, status: { $in: ["pending", "completed"] } });

    const totalEarnings = allOrders.reduce((sum, order) => {
      const adminFee = order.adminFee > 0 ? order.adminFee : order.price * 0.02;
      const sellerNet = order.price - adminFee;
      return sum + sellerNet;
    }, 0);

    res.status(200).json({
      userId: id,
      earnings: Math.round(totalEarnings * 100) / 100,
    });
  } catch (error) {
    console.error("❌ Gagal ambil dana dari Order:", error);
    res.status(500).json({ error: "Gagal ambil dana ditahan dari Order" });
  }
});


export default router;
