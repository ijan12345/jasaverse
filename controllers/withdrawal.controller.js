import Withdrawal from "../models/withdrawal.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  requestBankPayout,
} from "../services/xendit.services.js";

dotenv.config();

const getAvailableEarnings = async (sellerId) => {
  const completedOrders = await Order.find({
    sellerId,
    status: "completed",
    isWithdrawn: { $ne: true },
  });

  const totalEarnings = completedOrders.reduce((sum, order) => {
    const adminFee = order.adminFee ?? order.price * 0.12;
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

  // KURANGI SALDO USER / ADMIN
  const targetUser = await User.findById(withdrawal.userId);
  if (targetUser) {
    const newBalance = (targetUser.availableBalance || 0) - withdrawal.amount;
targetUser.availableBalance = newBalance < 0 ? 0 : newBalance;

    await targetUser.save();
    console.log(`💸 Balance ${targetUser.username} dikurangi: ${withdrawal.amount}`);
  }
    // ✅ Merge data webhook ke payoutResponse
  withdrawal.payoutResponse = {
    ...withdrawal.payoutResponse,
    bank_code: event.bank_code,
    account_holder_name: event.account_holder_name,
    disbursement_description: event.disbursement_description,
    is_instant: event.is_instant,
    id: event.id,
    created: event.created,
    updated: event.updated,
    external_id: event.external_id,
  };
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

    let balanceOwner = sellerId || userId;
   let ownerUser = null;
let availableBalance = 0;

// Cek apakah ini penarikan admin
if (sellerId === "admin" && user.isAdmin) {
  ownerUser = user; // admin = user yang login
  availableBalance = user.availableBalance || 0;
} else {
  // seller biasa
  ownerUser = await User.findById(balanceOwner);
  if (!ownerUser) return next(createError(404, "Pemilik saldo tidak ditemukan"));
  availableBalance = ownerUser.availableBalance || 0;
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

    // ✅ Kurangi saldo user (admin atau seller)
    ownerUser.availableBalance = Math.max(availableBalance - amount, 0);
    await ownerUser.save();

    // ✅ Jika bukan admin, tandai order yang ditarik
    const isAdminWithdrawal = user.isAdmin && sellerId === "admin";
    if (!isAdminWithdrawal) {
      const eligibleOrders = await Order.find({
        sellerId: balanceOwner,
        status: "completed",
        isWithdrawn: { $ne: true },
      }).sort({ createdAt: 1 });

      let accumulated = 0;
      const orderIdsToUpdate = [];

      for (const order of eligibleOrders) {
        const adminFee = order.adminFee ?? order.price * 0.12;
        const netEarning = order.price - adminFee;

        if (accumulated + netEarning <= amount) {
          accumulated += netEarning;
          orderIdsToUpdate.push(order._id);
        } else {
          break;
        }
      }

      if (orderIdsToUpdate.length > 0) {
        await Order.updateMany(
          { _id: { $in: orderIdsToUpdate } },
          { $set: { isWithdrawn: true } }
        );
      }
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

   const updatedUser = await User.findById(userId); // ambil user terbaru setelah saldo dikurangi

res.status(201).json({
  message: "✅ Permintaan penarikan berhasil dikirim ke Xendit",
  withdrawal,
  user: updatedUser,
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

export const getAdminWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({
      sellerId: "admin"
    })
      .populate("userId", "username email")
      .sort({ createdAt: -1 });

    res.status(200).json(withdrawals);
  } catch (err) {
    next(err);
  }
};
