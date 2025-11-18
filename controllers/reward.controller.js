// controllers/reward.controller.js
import RewardRedemption from "../models/rewardRedemption.model.js";
import User from "../models/user.model.js";

export const redeemReward = async (req, res) => {
  try {
    const userId = req.userId;
    const { pointsUsed, amount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    // ✅ Cek apakah user sudah pernah redeem reward ini
    const alreadyRedeemed = await RewardRedemption.findOne({
      userId,
      pointsUsed,
      amount,
    });
    if (alreadyRedeemed) {
      return res
        .status(400)
        .json({ message: "Reward ini sudah pernah kamu klaim dan dikunci." });
    }

    // ✅ Tidak perlu kurangi poin user
    // Hanya buat klaim dan tunggu verifikasi admin
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
        "Permintaan redeem berhasil dikirim ✅ Admin akan memverifikasi dan mentransfer dana ke akun DANA kamu dalam 1–3 hari kerja.",
      redemption,
    });
  } catch (err) {
    console.error("❌ Gagal klaim reward:", err);
    res.status(500).json({
      message: "Gagal klaim reward",
      error: err.message,
    });
  }
};


export const getUserRedemptions = async (req, res) => {
  try {
    const userId = req.userId;
    const redemptions = await RewardRedemption.find({ userId });

    res.status(200).json(redemptions);
  } catch (err) {
    console.error("❌ Gagal ambil data redeem:", err);
    res.status(500).json({ message: "Gagal mengambil data redeem" });
  }
};


// ✅ Ambil semua reward yang pending
export const getPendingRewards = async (req, res) => {
  try {
    const rewards = await RewardRedemption.find({ status: "pending" })
      .populate("userId", "username email phone address") // ✅ tambahkan ini
      .sort({ createdAt: -1 });
    res.status(200).json(rewards);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil data pending", error: err.message });
  }
};


// ✅ Admin menyetujui reward
export const approveReward = async (req, res) => {
  try {
    const { id } = req.params;
    const reward = await RewardRedemption.findById(id);
    if (!reward) return res.status(404).json({ message: "Reward tidak ditemukan" });

    reward.status = "approved";
    await reward.save();

    res.status(200).json({ message: "Reward berhasil disetujui ✅", reward });
  } catch (err) {
    res.status(500).json({ message: "Gagal menyetujui reward", error: err.message });
  }
};

// ❌ Admin menolak reward
export const rejectReward = async (req, res) => {
  try {
    const { id } = req.params;
    const reward = await RewardRedemption.findById(id);
    if (!reward) return res.status(404).json({ message: "Reward tidak ditemukan" });

    reward.status = "rejected";
    await reward.save();

    res.status(200).json({ message: "Reward telah ditolak ❌", reward });
  } catch (err) {
    res.status(500).json({ message: "Gagal menolak reward", error: err.message });
  }
};
