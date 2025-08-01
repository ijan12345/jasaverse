// cron/refundEscrowJob.js
import cron from "node-cron";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";

cron.schedule("0 0 * * *", async () => {
  try {
    const now = new Date();

    /** -------------------------- */
    /** 1. Refund ke pembeli (30 hari) */
    /** -------------------------- */
    const refundExpiredTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ordersToRefund = await Order.find({
      createdAt: { $lte: refundExpiredTime },
      sellerAccepted: false,
      buyerConfirmed: false,
      escrowStatus: "held",
      status: { $ne: "failed" },
    });

    for (const order of ordersToRefund) {
      const admin = await User.findOne({ role: "admin" });
      const seller = await User.findById(order.sellerId);

      const adminFee = order.adminFee ?? order.price * 0.02;
      const sellerRevenue = order.price - adminFee;

      if (admin) {
        admin.pendingBalance = Math.max((admin.pendingBalance || 0) - adminFee, 0);
        await admin.save();
      }

      if (seller) {
        seller.pendingBalance = Math.max((seller.pendingBalance || 0) - sellerRevenue, 0);
        await seller.save();
      }

      order.escrowStatus = "refunded";
      order.refundedAt = new Date();
      order.status = "failed";
      await order.save();

      console.log(`🔁 Order ${order._id} direfund otomatis (tidak ada aksi selama 30 hari)`);
    }

    /** -------------------------- */
    /** 2. Release ke penjual (25 hari setelah terima layanan) */
    /** -------------------------- */
    const releaseExpiredTime = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
    const ordersToRelease = await Order.find({
      acceptedAt: { $lte: releaseExpiredTime },
      sellerAccepted: true,
      buyerConfirmed: false,
      escrowStatus: "held",
      status: "pending",
    });

    for (const order of ordersToRelease) {
      const admin = await User.findOne({ role: "admin" });
      const seller = await User.findById(order.sellerId);

      const adminFee = order.adminFee ?? order.price * 0.02;
      const sellerRevenue = order.price - adminFee;

      if (admin) {
        admin.pendingBalance = (admin.pendingBalance || 0) - adminFee;
        admin.balance = (admin.balance || 0) + adminFee;
        await admin.save();
      }

      if (seller) {
        seller.pendingBalance = (seller.pendingBalance || 0) - sellerRevenue;
        seller.balance = (seller.balance || 0) + sellerRevenue;
        await seller.save();
      }

      order.escrowStatus = "released";
      order.releasedAt = new Date();
      order.released = true;
      order.status = "completed";
      await order.save();

      console.log(`💸 Order ${order._id} otomatis dicairkan ke penjual (25 hari setelah layanan diterima)`);
    }

  } catch (err) {
    console.error("❌ Gagal menjalankan cron refund/release:", err);
  }
});
