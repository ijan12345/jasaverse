import Withdrawal from "../models/withdrawal.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  requestBankPayout,
  requestEwalletPayout,
} from "../services/xendit.services.js";

dotenv.config();

const getAvailableEarnings = async (sellerId) => {
  const completedOrders = await Order.find({
    sellerId,
    status: "completed",
    isWithdrawn: { $ne: true },
  });

  const totalEarnings = completedOrders.reduce((sum, order) => {
    const adminFee = order.adminFee ?? order.price * 0.02;
    return sum + (order.price - adminFee);
  }, 0);

  return totalEarnings;
};


// ✅ Webhook dari Xendit
export const handleXenditWebhook = async (req, res) => {
  try {
    const event = req.body;

    console.log("📩 Webhook Xendit masuk:", event);

    const status = event.status?.toLowerCase();

    if (!event.external_id) {
      return res.status(400).send("Missing external_id from webhook");
    }

    // Cari withdrawal berdasarkan external_id
    const withdrawal = await Withdrawal.findOne({ "payoutResponse.external_id": event.external_id });

    if (!withdrawal) {
      console.warn("⚠️ Withdrawal tidak ditemukan untuk external_id:", event.external_id);
      return res.status(404).send("Withdrawal not found");
    }

    if (status === "completed") {
      withdrawal.status = "success";
    } else if (status === "failed") {
      withdrawal.status = "failed";
    }

    await withdrawal.save();

    res.status(200).send("✅ Webhook diterima dan status diperbarui");
  } catch (err) {
    console.error("❌ Gagal proses webhook:", err.message);
    res.status(500).send("Webhook error");
  }
};

// ✅ Request penarikan saldo (Bank & E-wallet)
export const requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, method, destination, note, sellerId } = req.body;
    const userId = req.userId;

    const bankMethods = ["bca", "bri", "bni", "mandiri", "cimb", "permata"];
    if (!bankMethods.includes(method.toLowerCase())) {
      return next(createError(400, "Metode penarikan tidak valid (hanya bank)"));
    }

    if (!destination || destination.length < 6 || destination.length > 20) {
      return next(createError(400, "Nomor rekening tidak valid"));
    }

    if (!amount || amount < 10000) {
      return next(createError(400, "Minimal penarikan Rp10.000"));
    }

    const user = await User.findById(userId);
    if (!user) return next(createError(404, "User tidak ditemukan"));

    let availableBalance = 0;
    let balanceOwner = userId;

    if (user.isAdmin && sellerId === "admin") {
      const adminIncome = await Order.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$adminFee" } } },
      ]);
      const totalAdminFee = adminIncome[0]?.total || 0;

      const adminWithdrawals = await Withdrawal.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), sellerId: "admin", status: { $ne: "failed" } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const totalWithdrawn = adminWithdrawals[0]?.total || 0;

      availableBalance = totalAdminFee - totalWithdrawn;
      balanceOwner = "admin";
    } else {
      balanceOwner = sellerId || userId;
      availableBalance = await getAvailableEarnings(balanceOwner);
    }

    if (amount > availableBalance) {
      return next(createError(400, "Saldo tidak mencukupi untuk penarikan ini"));
    }

    const external_id = `withdraw-${balanceOwner}-${Date.now()}`;

    const xenditResponse = await requestBankPayout({
      external_id,
      amount,
      bank_code: method.toUpperCase(),
      account_holder_name: user.username || "User",
      account_number: destination,
      description: note || "Penarikan saldo",
    });

    // Jika user biasa (seller), tandai order sebagai isWithdrawn
    if (!user.isAdmin || sellerId !== "admin") {
      await Order.updateMany(
        { sellerId: balanceOwner, status: "completed", isWithdrawn: { $ne: true } },
        { $set: { isWithdrawn: true } }
      );
    }

    const withdrawal = await Withdrawal.create({
      userId,
      sellerId: balanceOwner,
      amount,
      method: method.toUpperCase(),
      destination,
      note,
      externalId: external_id,
      status: xenditResponse.status?.toLowerCase() || "pending",
      payoutResponse: xenditResponse,
    });

    res.status(201).json({
      message: "✅ Permintaan penarikan berhasil dikirim ke Xendit",
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Error Xendit:", err?.response?.data || err.message);
    next(createError(500, "Gagal melakukan penarikan via Xendit"));
  }
};

export const getMyWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(withdrawals);
  } catch (err) {
    next(err);
  }
};

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

// Admin update status manual
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
      message: "✅ Status penarikan diperbarui",
      withdrawal: updated,
    });
  } catch (err) {
    next(err);
  }
};