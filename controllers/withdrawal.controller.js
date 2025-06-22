import Withdrawal from "../models/withdrawal.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import mongoose from "mongoose";
import { requestPayout } from "../services/tripay.service.js";
// import { requestPayout } from "../services/tripay.service.js"; // Aktifkan ini jika pakai Tripay

/**
 * Hitung saldo yang tersedia untuk ditarik oleh user (hanya order selesai).
 */
const getAvailableEarnings = async (userId) => {
  const completedOrders = await Order.find({ sellerId: userId, status: "completed" });

  const totalEarnings = completedOrders.reduce((sum, order) => {
    const adminFee = order.adminFee ?? order.price * 0.02;
    const net = order.price - adminFee;
    return sum + net;
  }, 0);

  const totalWithdrawn = await Withdrawal.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: { $ne: "failed" } } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  return totalEarnings - (totalWithdrawn[0]?.total || 0);
};

export const requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, method, destination, note } = req.body;
    const userId = req.userId;

    const allowedMethods = ["bca", "bri", "bni", "dana", "ovo", "qris"];
    if (!allowedMethods.includes(method)) {
      return next(createError(400, "Metode penarikan tidak valid"));
    }

    if (!destination || destination.length < 6 || destination.length > 20) {
      return next(createError(400, "Nomor tujuan tidak valid"));
    }

    if (!amount || amount < 10000) {
      return next(createError(400, "Minimal penarikan adalah Rp10.000"));
    }

    const user = await User.findById(userId);
    if (!user) return next(createError(404, "User tidak ditemukan"));

    let availableBalance = 0;

    // ✅ Jika user adalah admin, hitung dari adminFee
    if (user.isAdmin) {
      const adminIncome = await Order.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$adminFee" },
          },
        },
      ]);
      const totalAdminFee = adminIncome[0]?.total || 0;

      const adminWithdrawals = await Withdrawal.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: { $ne: "failed" },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]);

      const totalWithdrawn = adminWithdrawals[0]?.total || 0;

      availableBalance = totalAdminFee - totalWithdrawn;
    } else {
      // ✅ Jika seller biasa
      availableBalance = await getAvailableEarnings(userId);
    }

    if (amount > availableBalance) {
      return next(createError(400, "Saldo tidak mencukupi untuk penarikan ini"));
    }

    // ✅ Kirim ke Tripay payout
    const payoutResult = await requestPayout({
      amount,
      bankCode: method,
      accountNumber: destination,
      name: user.username || "Pengguna",
      note,
    });

    const withdrawal = await Withdrawal.create({
      userId,
      amount,
      method,
      destination,
      note,
      status: "pending",
      payoutResponse: payoutResult,
    });

    res.status(201).json({
      message: "Permintaan penarikan berhasil dikirim ke Tripay",
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Error Tripay:", err?.response?.data || err.message);
    next(createError(500, "Gagal melakukan penarikan via Tripay"));
  }
};

/**
 * ✅ [GET] /api/withdrawals/my
 * Ambil daftar permintaan penarikan milik user.
 */
export const getMyWithdrawals = async (req, res, next) => {
  try {
    const userId = req.userId;
    const withdrawals = await Withdrawal.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(withdrawals);
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ [GET] /api/withdrawals
 * Admin: Lihat semua permintaan withdrawal.
 */
export const getAllWithdrawals = async (req, res, next) => {
  try {
    const data = await Withdrawal.find()
      .populate("userId", "username email")
      .sort({ createdAt: -1 });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ [PUT] /api/withdrawals/:id
 * Admin: Ubah status withdrawal.
 */
export const updateWithdrawalStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!["pending", "success", "failed"].includes(status)) {
      return next(createError(400, "Status tidak valid"));
    }

    const updated = await Withdrawal.findByIdAndUpdate(
      id,
      { status, note },
      { new: true }
    );

    if (!updated) return next(createError(404, "Data penarikan tidak ditemukan"));

    res.status(200).json({
      message: "Status penarikan diperbarui",
      withdrawal: updated,
    });
  } catch (err) {
    next(err);
  }
};
