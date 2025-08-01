import createError from "../utils/createError.js";
import Order from "../models/order.model.js";
import Gig from "../models/gig.model.js";
import mongoose from "mongoose";
//import Stripe from "stripe";
import dotenv from "dotenv";
import cron from 'node-cron';
import midtransClient from "midtrans-client";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { io } from "../server.js";
import cloudinary from "cloudinary"; // pastikan sudah diimport
import { createXenditInvoice } from "../services/xendit.services.js";
import XenditMapping from "../models/XenditMapping.js"; // <-- tambahkan ini di ata





dotenv.config({ path: './.env' });  



// Inisialisasi midtrans
const midtrans = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});




// const IDR_TO_USD_CONVERSION_RATE = parseFloat(process.env.IDR_TO_USD_CONVERSION_RATE) || 15885;
// const stripe = new Stripe(process.env.STRIPE);

/**
 * ✅ Membuat Payment Intent untuk order baru
 */
export const intent = async (req, res, next) => {
  try {
    const { gigId, email, name, phone, buyerId } = req.body;

    if (!gigId || !mongoose.Types.ObjectId.isValid(gigId)) {
      return res.status(400).json({ message: "gigId tidak valid" });
    }

    const gig = await Gig.findById(gigId).lean();
    if (!gig) return res.status(404).json({ message: "Gig tidak ditemukan" });

    // 🔒 Tambahan validasi: cek apakah ada order yang masih aktif untuk gig yang sama
    const existingOrder = await Order.findOne({
      gigId: gigId,
      status: { $in: ["pending", "in_progress", "accepted", "awaiting_seller_acceptance"] },
    });

    if (existingOrder) {
      return res.status(400).json({
        message: "Order untuk gig ini masih dalam proses. Selesaikan order sebelumnya terlebih dahulu.",
      });
    }

    const order_id = "ORDER-" + Date.now();

    const invoice = await createXenditInvoice({
      external_id: order_id,
      payer_email: email,
      amount: gig.price,
      description: gig.title,
      customer: {
        email,
        given_names: name,
        mobile_number: phone,
      },
      metadata: {
        gigId: String(gigId),
        buyerId: String(buyerId),
      },
    });

    await XenditMapping.create({
      external_id: order_id,
      gigId: String(gigId),
      buyerId: String(buyerId),
    });

    if (!invoice?.invoice_url) {
      console.error("❌ Gagal membuat invoice:", invoice);
      return res.status(500).json({ message: "Gagal membuat invoice Xendit" });
    }

    return res.status(200).json({
      invoice_url: invoice.invoice_url,
      orderId: order_id,
    });
  } catch (err) {
    console.error("❌ Error create Xendit invoice:", err.message);
    next(err);
  }
};
export const deleteConversationsWithCompletedOrCanceledOrder = async (req, res, next) => {
  try {
    const orders = await Order.find({ status: { $in: ["completed", "canceled"] } });
    const orderIds = orders.map(order => order._id);

    const conversations = await Conversation.find({ orderId: { $in: orderIds } });
    const conversationIds = conversations.map(conv => conv._id);

    const messages = await Message.find({ conversationId: { $in: conversationIds } });

    // Hapus file cloudinary jika ada
    for (const msg of messages) {
      let publicId = msg.filePublicId;
      if (!publicId && msg.file?.includes("res.cloudinary.com")) {
        const filename = msg.file.split("/").pop();
        publicId = `messages/${filename.split(".")[0]}`;
      }
      if (publicId) {
        try {
          await cloudinary.v2.uploader.destroy(publicId);
        } catch (err) {
          console.error("Gagal hapus file:", publicId, err.message);
        }
      }
    }

    await Message.deleteMany({ conversationId: { $in: conversationIds } });
    await Conversation.deleteMany({ _id: { $in: conversationIds } });

    // 🔥 Emit ke frontend agar hilang real-time
    conversations.forEach((conv) => {
      io.emit("conversation:deleted", { conversationId: conv._id.toString() });
    });

    res.status(200).json({ message: `Hapus ${conversations.length} percakapan sukses.` });
  } catch (err) {
    console.error("Gagal hapus otomatis percakapan:", err.message);
    next(err);
  }
};

const deleteConversationsByOrderId = async (orderId) => {
  try {
    const conversations = await Conversation.find({ orderId });

    for (const conv of conversations) {
      const messages = await Message.find({ conversationId: conv._id });

      for (const msg of messages) {
        let publicId = msg.filePublicId;
        if (!publicId && msg.file?.includes("res.cloudinary.com")) {
          const parts = msg.file.split("/");
          const filename = parts[parts.length - 1];
          publicId = `messages/${filename.split(".")[0]}`;
        }

        if (publicId) {
          try {
            await cloudinary.v2.uploader.destroy(publicId);
          } catch (err) {
            console.error("❌ Gagal hapus Cloudinary:", publicId, err.message);
          }
        }
      }

      await Message.deleteMany({ conversationId: conv._id });
      await conv.deleteOne();
    }
    console.log(`🗑️ Percakapan terkait order ${orderId} dihapus otomatis.`);
  } catch (err) {
    console.error("❌ Gagal hapus percakapan otomatis:", err);
  }
};


export const acceptOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return next(createError(404, "Order tidak ditemukan"));

    // Cek apakah user ini adalah seller dari order tersebut
    if (order.sellerId.toString() !== req.userId)
      return next(createError(403, "Tidak diizinkan"));

    if (order.sellerAccepted)
      return next(createError(400, "Order sudah diterima sebelumnya"));

    order.sellerAccepted = true;
    order.progressStatus = "accepted";
    order.workStartedAt = new Date(); // ⬅️ Mencatat waktu mulai kerja
    await order.save();

    res.status(200).json({ message: "Order diterima", order });
  } catch (err) {
    next(err);
  }
};

export const confirmOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) return next(createError(404, "Order not found"));
    if (order.buyerId.toString() !== req.userId) return next(createError(403, "Unauthorized"));

    if (order.escrowStatus === "released") return next(createError(400, "Escrow already released"));

    order.buyerConfirmed = true;
    order.escrowStatus = "released";
    order.escrowReleasedAt = new Date();
    order.progressStatus = "delivered";

    await order.save();

    res.status(200).json({ message: "Order confirmed and funds released", order });
  } catch (err) {
    next(err);
  }
};

// /orders/:id/progress (PUT request)
export const updateProgressStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { progressStatus } = req.body;

    const allowedStatus = [
      "awaiting_seller_acceptance",
      "accepted",
      "in_progress",
      "revision_requested",
      "extra_revision_requested",
      "extra_revision_paid",
      "delivered",
       "seller_refunded",
    ];

    if (!allowedStatus.includes(progressStatus)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    const order = await Order.findById(id);
    if (!order) return next(createError(404, "Order tidak ditemukan"));

    order.progressStatus = progressStatus;
    await order.save();

    res.status(200).json({
      message: `Progress berhasil diubah menjadi '${progressStatus}'`,
      updatedOrder: order,
    });
  } catch (err) {
    next(err);
  }
};
export const addExtraRequest = async (req, res, next) => {
  try {
    const { description, amount, name, email, address } = req.body;
    const { id } = req.params;

    if (!description || !amount) {
      return res.status(400).json({ message: "Deskripsi dan jumlah harus diisi" });
    }

    const order = await Order.findById(id);
    if (!order) return next(createError(404, "Order tidak ditemukan"));

    if (
      order.buyerId.toString() !== req.userId &&
      order.sellerId.toString() !== req.userId
    ) {
      return next(createError(403, "Anda tidak memiliki akses ke order ini"));
    }

    order.extraRequest = {
      description,
      amount,
      status: "pending",
    };
    order.progressStatus = "extra_revision_requested";
    await order.save();

    const extraOrderId = `EXTRA-${Date.now()}`;

    const invoice = await createXenditInvoice({
      external_id: extraOrderId,
      payer_email: email,
      amount: Number(amount),
      description: `Extra Payment - ${description}`,
      customer: {
        email,
        given_names: name,
        mobile_number: address || "",
      },
      metadata: {
        gigId: String(order.gigId),
        buyerId: String(req.userId),
        relatedOrderId: String(order._id),
      },
    });

    if (!invoice?.invoice_url) {
      return res.status(500).json({ message: "Gagal membuat invoice Xendit" });
    }

    return res.status(200).json({
      message: "Permintaan tambahan berhasil diajukan",
      extraRequest: order.extraRequest,
      invoice_url: invoice.invoice_url,
      orderId: extraOrderId,
    });
  } catch (err) {
    console.error("❌ Error addExtraRequest:", err);
    next(err);
  }
};

export const handleExtraPayment = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone, // ✅ ganti dari address
      buyerId,
      sellerId,
      amount,
      description,
      relatedOrderId,
    } = req.body;

    // Validasi data
    if (
      !name || !email || !phone ||
      !amount || !description ||
      !buyerId || !sellerId || !relatedOrderId
    ) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    if (!mongoose.Types.ObjectId.isValid(relatedOrderId)) {
      return res.status(400).json({ message: "ID order terkait tidak valid" });
    }

    const external_id = `EXTRA-${Date.now()}`;

    // Kirim ke Xendit
const invoice = await createXenditInvoice({
  external_id,
  amount: Number(amount),
  description: `Extra Payment - ${description}`,
  payer_email: email,
  customer: {
    given_names: name,
    email,
    mobile_number: phone,
  },
  metadata: {
    gigId: null,
    buyerId,
    sellerId,
    relatedOrderId,
  },
});


    // Simpan mapping agar bisa dikenali di webhook
    await XenditMapping.create({
      external_id,
      gigId: null, // jika tidak ada gig, bisa di-set null
      buyerId,
       relatedOrderId,
      createdAt: new Date(),
    });

    res.status(200).json({
      message: "Invoice Xendit tambahan berhasil dibuat",
      invoice_url: invoice.invoice_url,
      orderId: external_id,
    });
  } catch (err) {
    console.error("❌ handleExtraPayment error:", err?.response?.data || err.message);
    res.status(500).json({ message: "Gagal memproses pembayaran tambahan" });
  }
};

export const getAdminRevenue = async (req, res) => {
  try {
    const orders = await Order.find({ status: "completed" });

    const totalAdminFee = orders.reduce((sum, o) => sum + (o.adminFee || 0), 0);

    res.status(200).json({ totalAdminFee });
  } catch (err) {
    console.error("Error ambil revenue admin:", err);
    res.status(500).json({ message: "Gagal ambil revenue admin" });
  }
};

export const rejectOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) return next(createError(404, "Order tidak ditemukan"));
    if (order.sellerId.toString() !== req.userId)
      return next(createError(403, "Tidak diizinkan"));

    if (order.status !== "pending")
      return next(createError(400, "Order tidak bisa ditolak"));

    order.status = "canceled";
    order.escrowStatus = "refunded";
    order.refundedAt = new Date();

    await order.save();
await deleteConversationsByOrderId(order._id);

    console.log("✅ Order ditandai refund manual oleh admin");
    res.status(200).json({
      message: "Order ditolak. Refund akan diproses manual oleh admin.",
      order,
    });
  } catch (err) {
    next(err);
  }
};

export const handleXenditWebhook = async (req, res) => {
  console.log("📩 Webhook payload:", JSON.stringify(req.body, null, 2));
  try {
    const event = req.body;
    const order_id = event?.external_id;
    const status = event?.status?.toLowerCase();

    if (!order_id || status !== "paid") {
      console.log("✅ Dilewati: webhook bukan pembayaran sukses");
      return res.status(200).send("Dilewati");
    }

    // ✅ Ambil metadata dari DB (karena tidak dikirim oleh webhook)
    const mapping = await XenditMapping.findOne({ external_id: order_id });
    if (!mapping) {
      console.error("❌ Mapping metadata tidak ditemukan untuk external_id:", order_id);
      return res.status(400).json({ message: "gigId tidak valid" });
    }

    const gigId = mapping.gigId;
    const buyerIdFromXendit = mapping.buyerId;

    const email = event.payer_email;
    const name = email?.split("@")[0] || "buyer";
    const address = ""; // Tidak dikirim di webhook
    const relatedOrderId = null; // default, hanya dipakai untuk EXTRA

    // ✅ HANDLE EXTRA PAYMENT
    if (order_id.startsWith("EXTRA-")) {
      console.log("🔄 Pembayaran tambahan (extra-request) terdeteksi");

      if (!mapping.relatedOrderId || !mongoose.Types.ObjectId.isValid(mapping.relatedOrderId)) {
        console.error("❌ relatedOrderId tidak valid:", mapping.relatedOrderId);
        return res.status(400).json({ message: "relatedOrderId tidak valid" });
      }

      const relatedOrder = await Order.findById(mapping.relatedOrderId);
      if (!relatedOrder) {
        console.error(`❌ Order terkait ${mapping.relatedOrderId} tidak ditemukan`);
        return res.status(404).json({ message: "Order terkait tidak ditemukan" });
      }

      if (relatedOrder.extraRequest) {
        relatedOrder.extraRequest.status = "paid";
        relatedOrder.progressStatus = "extra_paid";
        relatedOrder.price += Number(relatedOrder.extraRequest.amount || 0);
        relatedOrder.adminFee = Math.round(relatedOrder.price * 0.02 * 100) / 100;
        await relatedOrder.save();
        console.log(`✅ Extra request pada order ${mapping.relatedOrderId} ditandai sebagai 'paid'`);
      } else {
        console.warn(`⚠️ Order ${mapping.relatedOrderId} tidak memiliki extraRequest`);
      }

      return res.status(200).json({ message: "Pembayaran tambahan berhasil diproses" });
    }

    // ✅ HANDLE PEMBAYARAN ORDER UTAMA
    if (!gigId || !mongoose.Types.ObjectId.isValid(gigId)) {
      console.error("❌ gigId tidak ditemukan atau tidak valid");
      return res.status(400).json({ message: "gigId tidak valid" });
    }

    const gig = await Gig.findById(gigId);
    if (!gig) {
      console.error(`❌ Gig ${gigId} tidak ditemukan`);
      return res.status(404).json({ message: "Gig tidak ditemukan" });
    }

    let user = await User.findOne({ email });
    if (!user && email) {
      try {
        user = await User.create({
          email,
          username: name,
          img: "",
          country: "ID",
          isSeller: false,
        });
        console.log(`👤 User baru dibuat: ${user.username}`);
      } catch (err) {
        console.error("❌ Gagal membuat user:", err.message);
      }
    }

    const buyerId = buyerIdFromXendit || user?._id || null;


    let order = await Order.findOne({ payment_intent: order_id });
    if (!order) {
      try {
        order = await Order.create({
          gigId,
          title: gig.title,
          img: gig.cover,
          price: gig.price,
          sellerId: gig.userId,
          buyerId,
          status: "pending",
          payment_intent: order_id,
          customerEmail: email,
          customerAddress: address,
          customerName: name,
          adminFee: Math.round(gig.price * 0.02 * 100) / 100,
          isBalanceUpdated: false,
          released: false,
        });
        console.log(`✅ Order ${order_id} dibuat dengan status pending`);
      } catch (err) {
        console.error("❌ Gagal membuat order:", err.message);
        return res.status(500).json({ message: "Gagal membuat order" });
      }
    }

    if (!order.isBalanceUpdated) {
      order.buyerId = order.buyerId || buyerId;
      order.customerName = name;
      order.adminFee = Math.round(order.price * 0.02 * 100) / 100;

      const sellerRevenue = order.price - order.adminFee;
      const admin = await User.findOne({ role: "admin" });
      const seller = await User.findById(order.sellerId);

      if (admin && seller) {
        admin.pendingBalance = (admin.pendingBalance || 0) + order.adminFee;
        seller.pendingBalance = (seller.pendingBalance || 0) + sellerRevenue;

        await admin.save();
        await seller.save();

        console.log(`💰 Admin pendingBalance ditambah: ${order.adminFee}`);
        console.log(`💰 Seller pendingBalance ditambah: ${sellerRevenue}`);
      }

      order.isBalanceUpdated = true;
      await order.save();
      console.log(`✅ Order ${order_id} ditandai isBalanceUpdated = true`);
    } else {
      console.log(`ℹ️ Order ${order_id} sudah diproses & saldo ditandai`);
    }

    return res.status(200).json({
      message: "Order berhasil diproses dan saldo ditampung dalam pendingBalance",
      buyerId,
    });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ message: "Gagal memproses webhook" });
  }
};



export const rejectExtraRequest = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }

    // 🔥 Hapus extraRequest manual
    order.extraRequest = undefined;

    await order.save();

    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ Menghapus order  berdasarkan ID
 */ 
export const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(createError(400, "Format Order ID tidak valid"));

    const order = await Order.findByIdAndDelete(id);
    if (!order) return next(createError(404, "Pesanan tidak ditemukan"));

    res.status(200).json({ message: "Pesanan berhasil dihapus" });
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ Mengambil daftar order berdasarkan user (buyer/seller)
 */
export const getOrders = async (req, res, next) => {
  try {
    const filter = req.isSeller ? { sellerId: req.userId } : { buyerId: req.userId };
    const orders = await Order.find(filter)
      .populate("gigId", "title userId")
      .populate("buyerId", "username")
      .populate("sellerId", "username");

    const ordersWithDeadline = orders.map(order => {
      const orderData = order.toObject();

      if (orderData.dispute?.reportDate) {
        const deadline = new Date(orderData.dispute.reportDate);
        deadline.setHours(deadline.getHours() + 48);
        orderData.dispute.deadline = deadline;
      }

      return orderData;
    });

    res.status(200).json(ordersWithDeadline);
  } catch (err) {
    next(err);
  }
};

export const getOrderReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("sellerId", "username")
      .populate("buyerId", "username");

    if (!order) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    const orderData = order.toObject();

    if (orderData.dispute?.reportDate) {
      const deadline = new Date(orderData.dispute.reportDate);
      deadline.setHours(deadline.getHours() + 48);
      orderData.dispute.deadline = deadline;
    }

    res.status(200).json({
      message: "Struk order berhasil diambil",
      order: orderData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data struk order" });
  }
};

/**
 * ✅ Mengambil earnings dari penjual berdasarkan ID
 */
export const getEarnings = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(createError(400, "Format User ID tidak valid"));
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    res.status(200).json({
      userId,
      earnings: user.balance || 0,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ Menandai order sebagai "completed"
 */
export const completeOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, "Format Order ID tidak valid"));
    }

    const order = await Order.findById(id);
    if (!order) return next(createError(404, "Order tidak ditemukan"));

    if (!order.buyerId || order.buyerId.toString() !== req.userId) {
      return next(createError(403, "Hanya pembeli yang bisa menyelesaikan order ini"));
    }

    if (order.status === "completed") {
      return res.status(400).json({ message: "Order sudah diselesaikan sebelumnya" });
    }

    const admin = await User.findOne({ role: "admin" });
    const seller = await User.findById(order.sellerId);
    if (!admin || !seller) {
      return next(createError(404, "Admin atau Seller tidak ditemukan"));
    }

    const adminFee = order.adminFee ?? order.price * 0.02;
    const sellerRevenue = order.price - adminFee;

    // ✅ Update saldo admin
    admin.availableBalance = (admin.availableBalance ?? 0) + adminFee;
    await admin.save();

    // ✅ Update saldo seller
    seller.availableBalance = (seller.availableBalance ?? 0) + sellerRevenue;
    await seller.save();

    console.log(`✅ Dana Rp${adminFee} masuk ke saldo Admin`);
    console.log(`✅ Dana Rp${sellerRevenue} masuk ke saldo Seller`);

    // Tandai order selesai
    order.status = "completed";
    order.progressStatus = "delivered";
    order.workCompletedAt = new Date(); // ⬅️ Catat waktu selesai kerja
    order.escrowStatus = "released";
    order.escrowReleasedAt = new Date();
    order.released = true;
    await order.save();
await deleteConversationsByOrderId(order._id);

    // Tambah penjualan ke gig
    await Gig.findByIdAndUpdate(order.gigId, { $inc: { sales: 1 } });

    res.status(200).json({
      message: "Order berhasil diselesaikan. Dana masuk ke saldo Seller & Admin.",
      updatedOrder: order,
    });
  } catch (err) {
    next(err);
  }
};

export const reportDispute = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return next(createError(404, "Order tidak ditemukan"));
    if (order.buyerId.toString() !== req.userId)
      return next(createError(403, "Tidak diizinkan"));

    if (order.dispute?.status !== "none")
      return next(createError(400, "Order sudah dalam sengketa"));

    order.dispute = {
      reportedBy: req.userId,
      reason,
      reportDate: new Date(),
      status: "disputed",
      resolved: false,
    };

    await order.save();
    res.status(200).json({ message: "Order dilaporkan", order });
  } catch (err) {
    next(err);
  }
};

// ✅ Penjual membela order
export const respondDispute = async (req, res, next) => {
  try {
    const { response } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return next(createError(404, "Order tidak ditemukan"));
    if (order.sellerId.toString() !== req.userId)
      return next(createError(403, "Tidak diizinkan"));

    if (order.dispute?.status !== "disputed")
      return next(createError(400, "Order belum dilaporkan atau sudah diselesaikan"));

    order.dispute.sellerResponse = response;
    order.dispute.sellerRespondedAt = new Date();
    order.dispute.status = "under_review";

    await order.save();
    res.status(200).json({ message: "Pembelaan dikirim", order });
  } catch (err) {
    next(err);
  }
};

// GET /admin/disputes
export const getDisputedOrders = async (req, res, next) => {
  try {
    const disputedOrders = await Order.find({ "dispute.status": { $ne: "none" } })
      .populate("buyerId", "username email phone") // tambahkan email & phone
      .populate("sellerId", "username email phone") // tambahkan email & phone
      .populate("gigId", "title userId"); 

    res.status(200).json(disputedOrders);
  } catch (err) {
    next(err);
  }
};

// POST /admin/disputes/:id/resolve
export const resolveDispute = async (req, res, next) => {
  try {
    const { action, resolutionNote } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return next(createError(404, "Order tidak ditemukan"));

    if (order.dispute?.status !== "disputed" && order.dispute?.status !== "under_review")
      return next(createError(400, "Order ini tidak dalam status sengketa"));

    // ✅ Perbarui informasi dispute
    order.dispute.status = "resolved";
    order.dispute.resolved = true;
    order.dispute.resolutionNote = resolutionNote || "";
    order.dispute.resolvedBy = req.userId || "admin";
    order.dispute.resolvedAt = new Date();

    if (action === "refund") {
      order.status = "canceled";
      order.escrowStatus = "refunded";
       await deleteConversationsByOrderId(order._id);
    } else if (action === "release") {
      order.status = "completed";
      order.escrowStatus = "released";
        await deleteConversationsByOrderId(order._id);
      order.released = true;

      // ✅ Tambah saldo penjual & admin + hitung sales
      const seller = await User.findById(order.sellerId);
      const admin = await User.findOne({ role: "admin" });
      const adminFee = order.adminFee ?? order.price * 0.02;
      const sellerRevenue = order.price - adminFee;

      if (seller) {
        seller.availableBalance = (seller.availableBalance ?? 0) + sellerRevenue;
        await seller.save();
      }
      if (admin) {
        admin.availableBalance = (admin.availableBalance ?? 0) + adminFee;
        await admin.save();
      }

      // ✅ Tambah sales ke gig
      await Gig.findByIdAndUpdate(order.gigId, { $inc: { sales: 1 } });
} else if (action === "reject_dispute") {
  // ✅ Kembalikan ke status 'none' agar tidak muncul lagi di daftar dispute
  order.dispute.status = "none";
  order.dispute.resolved = false;
  order.dispute.reason = undefined;
  order.dispute.sellerResponse = undefined;
  order.dispute.resolutionNote = resolutionNote || "";
  order.dispute.resolvedAt = new Date();
} else {
      return next(createError(400, "Aksi tidak valid"));
    }

    await order.save();
    res.status(200).json({ message: "Sengketa telah diselesaikan", order });
  } catch (err) {
    next(err);
  }
};

export const deleteOrderByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return next(createError(400, "Format Order ID tidak valid"));

    const order = await Order.findByIdAndDelete(id);
    if (!order) return next(createError(404, "Order tidak ditemukan"));

    res.status(200).json({ message: "Order berhasil dihapus oleh admin" });
  } catch (err) {
    next(err);
  }
};


export const getPendingReleases = async (req, res, next) => {
  try {
    const orders = await Order.find({
      status: "completed",
      released: false,
    }).populate("sellerId", "username").populate("buyerId", "username");

    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
};

export const getOrderStats = async (req, res) => {
  try {
    const orders = await Order.find({});

    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === "completed").length;
    const unreleasedOrders = orders.filter((o) => o.status === "completed" && !o.isReleased);

    const monthlyStats = {}; // akan disusun jadi array
    let totalRevenue = 0;

    orders.forEach((order) => {
      const monthKey = new Date(order.createdAt).toLocaleString("id-ID", {
        month: "long",
        year: "numeric",
      });

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: monthKey,
          totalOrders: 0,
          completedOrders: 0,
          totalRevenue: 0,
        };
      }

      monthlyStats[monthKey].totalOrders += 1;

      if (order.status === "completed") {
        monthlyStats[monthKey].completedOrders += 1;
      }

      totalRevenue += order.price || 0;
      monthlyStats[monthKey].totalRevenue += order.price || 0;
    });

    res.status(200).json({
      totalOrders,
      completedOrders,
      pendingReleases: unreleasedOrders.length,
      totalRevenue,
      totalUnreleasedRevenue: unreleasedOrders.reduce((sum, o) => sum + o.price, 0),
      unreleasedOrderIds: unreleasedOrders.map((o) => o._id),
      ordersByStatus: orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {}),
      monthlyStats: Object.values(monthlyStats),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error statistik admin:", error);
    res.status(500).json({ message: "Gagal ambil statistik" });
  }
};
const refundToBuyer = async (order) => {
  const buyer = await User.findById(order.buyerId);
  if (!buyer) return console.log("❌ Buyer tidak ditemukan");

  buyer.availableBalance = (buyer.availableBalance || 0) + order.price;
  await buyer.save();

  console.log(`💸 REFUND: Dana Rp${order.price} dikembalikan ke ${buyer.username}`);
};


cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();

    const disputedOrders = await Order.find({
      'dispute.status': 'disputed',
      'dispute.createdAt': { $exists: true },
      'dispute.sellerResponse': { $exists: false },
      status: { $in: ['pending', 'in_progress'] },
      released: false,
    });

    for (const order of disputedOrders) {
      const createdAt = new Date(order.dispute.createdAt);
      const jamBerjalan = (now - createdAt) / (1000 * 60 * 60); // ke jam

      if (jamBerjalan >= 48) {
        await refundToBuyer(order);

        order.status = 'canceled';
        order.progressStatus = 'auto_refunded';
        order.released = false;
        order.dispute.status = 'refunded';
        await order.save();

        console.log(`✅ Order #${order._id} otomatis direfund karena penjual tidak merespons.`);
      }
    }
  } catch (error) {
    console.error('❌ Gagal cek dispute untuk refund otomatis:', error);
  }
});