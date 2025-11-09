// controllers/reward.controller.js
import RewardRedemption from "../models/rewardRedemption.model.js";
import User from "../models/user.model.js";
import Gig from "../models/gig.model.js";
import Order from "../models/order.model.js";

/**
 * 🎁 User mengajukan penukaran reward (redeem)
 */
export const redeemReward = async (req, res) => {
  try {
    const userId = req.userId;
    const { pointsUsed, amount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    // 🔹 Hitung ulang score user berdasar lifetime performance
    const totalGigs = await Gig.countDocuments({ userId });
    const totalCompletedOrders = await Order.countDocuments({
      sellerId: userId,
      status: "completed",
    });
    const recalculatedScore = totalCompletedOrders * 9 + totalGigs;

    // 🔹 Perbarui nilai score agar sinkron
    user.score = recalculatedScore;
    await user.save();

    // ✅ Cegah double claim
    const alreadyRedeemed = await RewardRedemption.findOne({
      userId,
      pointsUsed,
      amount,
    });
    if (alreadyRedeemed) {
      return res
        .status(400)
        .json({ message: "Reward ini sudah pernah kamu klaim sebelumnya." });
    }

    // ✅ Pastikan poin cukup
    if (user.score < pointsUsed) {
      return res.status(400).json({
        message: `Poin kamu tidak cukup. Dibutuhkan ${pointsUsed}, tapi kamu hanya punya ${user.score}.`,
      });
    }

    // ✅ Kurangi poin user (sementara, lifetimeSales tidak diubah)
    user.score -= pointsUsed;
    await user.save();

    // ✅ Simpan data redeem pending
    const redemption = new RewardRedemption({
      userId,
      rewardType: "DANA",
      amount,
      pointsUsed,
      phone: user.phone || "-",
      email: user.email || "-",
      address: user.address || "-",
      status: "pending",
    });

    await redemption.save();

    res.status(200).json({
      message:
        "✅ Permintaan redeem berhasil dikirim. Admin akan memverifikasi dan mentransfer dana ke akun DANA kamu dalam 1–3 hari kerja.",
      redemption,
      newScore: user.score,
      recalculatedScore, // tampilkan hasil recalculasi biar front-end bisa tampilkan real
    });
  } catch (err) {
    console.error("❌ Gagal klaim reward:", err);
    res.status(500).json({
      message: "Gagal klaim reward",
      error: err.message,
    });
  }
};

/**
 * 📜 Ambil daftar reward user yang sudah pernah diajukan
 */
export const getUserRedemptions = async (req, res) => {
  try {
    const userId = req.userId;
    const redemptions = await RewardRedemption.find({ userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(redemptions);
  } catch (err) {
    console.error("❌ Gagal ambil data redeem:", err);
    res.status(500).json({ message: "Gagal mengambil data redeem" });
  }
};

/**
 * 🕓 Admin melihat semua reward pending
 */
export const getPendingRewards = async (req, res) => {
  try {
    const rewards = await RewardRedemption.find({ status: "pending" })
      .populate("userId", "username email phone address")
      .sort({ createdAt: -1 });
    res.status(200).json(rewards);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Gagal mengambil data pending", error: err.message });
  }
};

/**
 * ✅ Admin menyetujui reward
 */
export const approveReward = async (req, res) => {
  try {
    const { id } = req.params;
    const reward = await RewardRedemption.findById(id);
    if (!reward)
      return res.status(404).json({ message: "Reward tidak ditemukan" });

    reward.status = "approved";
    reward.approvedAt = new Date();
    await reward.save();

    res.status(200).json({ message: "Reward berhasil disetujui ✅", reward });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Gagal menyetujui reward", error: err.message });
  }
};

/**
 * ❌ Admin menolak reward
 */
export const rejectReward = async (req, res) => {
  try {
    const { id } = req.params;
    const reward = await RewardRedemption.findById(id);
    if (!reward)
      return res.status(404).json({ message: "Reward tidak ditemukan" });

    reward.status = "rejected";
    reward.rejectedAt = new Date();
    await reward.save();

    // ✅ Kembalikan poin ke user
    const user = await User.findById(reward.userId);
    if (user) {
      user.score += reward.pointsUsed;
      await user.save();
    }

    res.status(200).json({
      message: "Reward telah ditolak ❌ dan poin dikembalikan ke user.",
      reward,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Gagal menolak reward", error: err.message });
  }
};
