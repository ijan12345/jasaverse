import createError from "../utils/createError.js";
import Order from "../models/order.model.js";
import Gig from "../models/gig.model.js";
import mongoose from "mongoose";
//import Stripe from "stripe";
import dotenv from "dotenv";
import cron from 'node-cron';
import nodemailer from "nodemailer";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { io } from "../server.js";
import cloudinary from "cloudinary"; // pastikan sudah diimport
import { createXenditInvoice } from "../services/xendit.services.js";
import XenditMapping from "../models/XenditMapping.js"; // <-- tambahkan ini di ata
import { checkAndUpdateSellerLevel } from "./user.controller.js";






dotenv.config({ path: './.env' });  



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



export const sendDeliveryEmail = async (req, res) => {
  try {
    const { id } = req.params; // orderId
    const { subject, message, attachmentUrl } = req.body;

    // ✅ Ambil order lengkap + populate user
    const order = await Order.findById(id)
      .populate("buyerId", "email username")
      .populate("sellerId", "email username");

    if (!order) return res.status(404).json({ message: "Order tidak ditemukan" });

    // 🧩 Deteksi otomatis jika buyerId/sellerId bukan ObjectId murni
    let buyer = order.buyerId;
    let seller = order.sellerId;

    // kalau masih object penuh, ambil ID-nya
    if (typeof buyer === "object" && !buyer.email) {
      buyer = await User.findById(buyer._id);
    } else if (typeof buyer !== "object") {
      buyer = await User.findById(buyer);
    }

    if (typeof seller === "object" && !seller.email) {
      seller = await User.findById(seller._id);
    } else if (typeof seller !== "object") {
      seller = await User.findById(seller);
    }

    if (!buyer?.email) return res.status(400).json({ message: "Email pembeli tidak ditemukan." });
    if (!seller?.email) return res.status(400).json({ message: "Email penjual tidak ditemukan." });

    // ✅ Siapkan transporter email (pakai Gmail misalnya)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // pastikan .env diisi
        pass: process.env.EMAIL_PASS,
      },
    });

    // ✅ Kirim email
    const mailOptions = {
      from: `"${seller.username}" <${process.env.EMAIL_USER}>`,
      to: buyer.email,
      subject: subject || `Hasil Pekerjaan Pesanan #${order._id}`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <p>Halo <b>${buyer.username}</b>,</p>
          <p>${message || "Berikut hasil pekerjaan Anda dari penjual SkillSap."}</p>
          ${
            attachmentUrl
              ? `<p>📎 Unduh hasil pekerjaan di sini:<br/><a href="${attachmentUrl}">${attachmentUrl}</a></p>`
              : ""
          }
          <p>Salam hangat,<br/><b>${seller.username}</b></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ Email terkirim ke ${buyer.email} dari ${seller.email}`);
    res.status(200).json({ message: `Email berhasil dikirim ke ${buyer.email}` });
  } catch (err) {
    console.error("❌ Gagal kirim email:", err);
    res.status(500).json({ message: "Gagal mengirim email", error: err.message });
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
    const { description, amount, name, email, phone, extraDays } = req.body;
    const { id } = req.params;

    if (!description || !amount) {
      return res.status(400).json({ message: "Deskripsi dan jumlah harus diisi" });
    }

    const order = await Order.findById(id).populate("gigId", "price deliveryTime");
    if (!order) return next(createError(404, "Order tidak ditemukan"));

    if (
      order.buyerId.toString() !== req.userId &&
      order.sellerId.toString() !== req.userId
    ) {
      return next(createError(403, "Anda tidak memiliki akses ke order ini"));
    }

    // 🔒 Validasi batas harga
    const maxTotalPrice = 10000000; // total maksimal 10 juta
    const totalAfterExtra = order.price + Number(amount);
    if (totalAfterExtra > maxTotalPrice) {
      return res.status(400).json({
        message: `Total harga tidak boleh lebih dari Rp ${maxTotalPrice.toLocaleString("id-ID")}`,
      });
    }

    // 🔒 Validasi batas hari
    const deliveryTime = order.gigId?.deliveryTime || 0;
    const maxTotalDays = 20; // total maksimal 20 hari
    const totalAfterExtraDays = deliveryTime + (Number(extraDays) || 0);
    if (totalAfterExtraDays > maxTotalDays) {
      return res.status(400).json({
        message: `Total hari tidak boleh lebih dari ${maxTotalDays} (normal ${deliveryTime} + tambahan ${extraDays})`,
      });
    }

    // Simpan ke order
    order.extraRequest = {
      description,
      amount,
      extraDays: Number(extraDays) || 0,
      status: "pending",
    };
    order.progressStatus = "extra_revision_requested";
    await order.save();

    const extraOrderId = `EXTRA-${Date.now()}`;

    // Buat invoice Xendit
    const invoice = await createXenditInvoice({
      external_id: extraOrderId,
      payer_email: email,
      amount: Number(amount),
      description: `Extra Payment - ${description}`,
      customer: {
        email,
        given_names: name,
        mobile_number: phone || "",
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
      phone,
      buyerId,
      sellerId,
      amount,
      description,
      relatedOrderId,
    } = req.body;

    // Validasi data dasar
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

    // 🔎 Ambil order terkait
    const relatedOrder = await Order.findById(relatedOrderId).populate("gigId", "price deliveryTime");
    if (!relatedOrder) {
      return res.status(404).json({ message: "Order terkait tidak ditemukan" });
    }

    // 🔒 Validasi batas harga
    const maxTotalPrice = 10000000; // total maksimal 10 juta
    const totalAfterExtra = relatedOrder.price + Number(amount);
    if (totalAfterExtra > maxTotalPrice) {
      return res.status(400).json({
        message: `Total harga tidak boleh lebih dari Rp ${maxTotalPrice.toLocaleString("id-ID")}`,
      });
    }

    // 🔒 Validasi batas hari
    const deliveryTime = relatedOrder.gigId?.deliveryTime || 0;
    const extraDaysExisting = relatedOrder.extraRequest?.extraDays || 0;
    const maxTotalDays = 20;
    const totalAfterExtraDays = deliveryTime + extraDaysExisting;
    if (totalAfterExtraDays > maxTotalDays) {
      return res.status(400).json({
        message: `Total hari tidak boleh lebih dari ${maxTotalDays} (normal ${deliveryTime} + tambahan ${extraDaysExisting})`,
      });
    }

    const external_id = `EXTRA-${Date.now()}`;

    // ✅ Buat invoice ke Xendit
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
      gigId: null,
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

    // ==========================================================
    // 🔹 AMBIL METADATA
    // ==========================================================
    const mapping = await XenditMapping.findOne({ external_id: order_id });
    if (!mapping) {
      console.error("❌ Mapping metadata tidak ditemukan untuk external_id:", order_id);
      return res.status(400).json({ message: "gigId tidak valid" });
    }

    const gigId = mapping.gigId;
    const buyerIdFromXendit = mapping.buyerId;
    const email = event.payer_email?.toLowerCase();
    const name = email?.split("@")[0] || "buyer";
    const address = "default";

    // ==========================================================
    // 🔹 PEMBAYARAN TAMBAHAN (EXTRA)
    // ==========================================================
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
        relatedOrder.adminFee = Math.round(relatedOrder.price * 0.12 * 100) / 100;
        await relatedOrder.save();

        console.log(`✅ Extra request pada order ${mapping.relatedOrderId} ditandai 'paid'`);
      } else {
        console.warn(`⚠️ Order ${mapping.relatedOrderId} tidak memiliki extraRequest`);
      }

      return res.status(200).json({ message: "Pembayaran tambahan berhasil diproses" });
    }

    // ==========================================================
    // 🔹 PEMBAYARAN ORDER UTAMA
    // ==========================================================
    if (!gigId || !mongoose.Types.ObjectId.isValid(gigId)) {
      console.error("❌ gigId tidak ditemukan atau tidak valid");
      return res.status(400).json({ message: "gigId tidak valid" });
    }

    const gig = await Gig.findById(gigId);
    if (!gig) {
      console.error(`❌ Gig ${gigId} tidak ditemukan`);
      return res.status(404).json({ message: "Gig tidak ditemukan" });
    }

    // ==========================================================
    // ✅ CARI ATAU BUAT USER TANPA DUPLIKAT
    // ==========================================================
    let user = await User.findOne({
      $or: [{ email }, { username: name }],
    });

    if (!user) {
      try {
        user = await User.create({
          email,
          username: name,
          img: "",
          address: address || "Alamat tidak tersedia",
          isSeller: false,
        });
        console.log(`👤 User baru dibuat: ${user.username}`);
      } catch (err) {
        if (err.code === 11000) {
          // ✅ Jika race condition, ambil user yang sudah ada
          user = await User.findOne({ $or: [{ email }, { username: name }] });
          console.log(`👤 Duplikat terdeteksi, pakai user lama: ${user.username}`);
        } else {
          console.error("❌ Gagal membuat user:", err.message);
          return res.status(500).json({ message: "Gagal membuat user" });
        }
      }
    } else {
      console.log(`👤 User sudah ada: ${user.username}`);
    }

    const buyerId = buyerIdFromXendit || user?._id || null;

    // ==========================================================
    // ✅ CEGAH ORDER DUPLIKAT
    // ==========================================================
    let order = await Order.findOne({ payment_intent: order_id });

    if (!order) {
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
        adminFee: Math.round(gig.price * 0.12 * 100) / 100,
        isBalanceUpdated: false,
        released: false,
        revisionLimit: gig.revisionNumber || 0,
        usedRevisions: 0,
      });

      console.log(`✅ Order ${order_id} dibuat dengan revisionLimit = ${gig.revisionNumber}`);
    } else {
      console.log(`ℹ️ Order ${order_id} sudah ada di database`);
    }

    // ==========================================================
    // ✅ UPDATE SALDO HANYA SEKALI
    // ==========================================================
    if (!order.isBalanceUpdated) {
      const sellerRevenue = order.price - order.adminFee;
      const admin = await User.findOne({ role: "admin" });
      const seller = await User.findById(order.sellerId);

      if (admin && seller) {
        admin.pendingBalance = (admin.pendingBalance || 0) + order.adminFee;
        seller.pendingBalance = (seller.pendingBalance || 0) + sellerRevenue;
        await admin.save();
        await seller.save();

        console.log(`💰 Admin pendingBalance +${order.adminFee}`);
        console.log(`💰 Seller pendingBalance +${sellerRevenue}`);
      }

      order.isBalanceUpdated = true;
      await order.save();
      console.log(`✅ Order ${order_id} ditandai isBalanceUpdated = true`);
    } else {
      console.log(`ℹ️ Order ${order_id} sudah diproses & saldo ditandai`);
    }

    // ==========================================================
    // ✅ RESPON SUKSES
    // ==========================================================
    return res.status(200).json({
      message: "✅ Order berhasil diproses & saldo ditampung dalam pendingBalance",
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

    if (!mongoose.Types.ObjectId.isValid(id))
      return next(createError(400, "Format Order ID tidak valid"));

    const order = await Order.findById(id);
    if (!order) return next(createError(404, "Pesanan tidak ditemukan"));

    // 🔐 Identifikasi user
    const isBuyer = String(order.buyerId) === String(req.userId);
    const isSeller = String(order.sellerId) === String(req.userId);

    if (!isBuyer && !isSeller)
      return next(createError(403, "Anda tidak berhak menghapus pesanan ini"));

    // Pastikan field sudah ada
    if (order.buyerDeleted === undefined) order.buyerDeleted = false;
    if (order.sellerDeleted === undefined) order.sellerDeleted = false;

    // 🧩 Update flag sesuai siapa yang hapus
    if (isBuyer) order.buyerDeleted = true;
    if (isSeller) order.sellerDeleted = true;

    // Simpan dulu perubahan flag
    await order.save();

    // 🔍 Jika keduanya sudah menghapus, hapus order dari database
    if (order.buyerDeleted && order.sellerDeleted) {
      await deleteConversationsByOrderId(order._id);

      // ⚙️ Kurangi totalSales seller, tapi lifetimeSales tetap
      const seller = await User.findById(order.sellerId);
      if (seller) {
        if (seller.totalSales && seller.totalSales > 0) {
          seller.totalSales = Math.max(0, seller.totalSales - 1);
        }
        // ❌ Jangan ubah lifetimeSales dan score
        await seller.save();
      }

      await Order.findByIdAndDelete(order._id);
      console.log(`🗑️ Order ${order._id} dihapus permanen (kedua pihak sudah hapus).`);

      return res.status(200).json({
        message: "Pesanan berhasil dihapus.",
      });
    }

    // Jika baru salah satu yang hapus → hanya disembunyikan
    res.status(200).json({
      message:
        "Pesanan berhasil dihapus.",
    });
  } catch (err) {
    next(err);
  }
};




/**
 * ✅ Mengambil daftar order berdasarkan user (buyer/seller)
 */
export const getOrders = async (req, res, next) => {
  try {
      const baseFilter = req.isSeller
      ? { sellerId: req.userId, sellerDeleted: { $ne: true } }
      : { buyerId: req.userId, buyerDeleted: { $ne: true } };

    const orders = await Order.find(baseFilter)
      .populate("gigId", "title userId revisionNumber deliveryTime")
      .populate("buyerId", "username")
      .populate("sellerId", "username");

    const ordersWithData = orders.map(order => {
      const orderData = order.toObject();
      const gig = order.gigId;

      // 🔹 Ambil data dari gig
      const deliveryTime = gig?.deliveryTime || 0;
      const revisionNumber = gig?.revisionNumber || 0;

      // 🔹 Pastikan revisionLimit punya nilai fallback kuat
      orderData.revisionLimit =
        orderData.revisionLimit && orderData.revisionLimit > 0
          ? orderData.revisionLimit
          : revisionNumber;

      // 🔹 Defaultkan usedRevisions kalau undefined
      orderData.usedRevisions =
        typeof orderData.usedRevisions === "number"
          ? orderData.usedRevisions
          : 0;

      // 🔹 Simpan info gig tambahan biar bisa dipakai frontend
      orderData.deliveryTime = deliveryTime;
      orderData.revisionNumber = revisionNumber;
      orderData.gigTitle = gig?.title || "Tanpa Judul";

      // 🔹 Tambahkan batas waktu dispute
      if (orderData.dispute?.reportDate) {
        const deadline = new Date(orderData.dispute.reportDate);
        deadline.setHours(deadline.getHours() + 48);
        orderData.dispute.deadline = deadline;
      }

      return orderData;
    });

    res.status(200).json(ordersWithData);
  } catch (err) {
    console.error("❌ Error getOrders:", err);
    next(err);
  }
};





export const getOrderReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("sellerId", "username")
      .populate("buyerId", "username")
      .populate("gigId", "title deliveryTime revisionNumber userId");

    if (!order) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    const orderData = order.toObject();
    const gig = order.gigId;

    // 🔹 Ambil data dari gig
    const deliveryTime = gig?.deliveryTime || 0;
    const revisionNumber = gig?.revisionNumber || 0;
    const extraDays = Number(orderData.extraRequest?.extraDays || 0);

    // 🔹 Hitung total hari dengan batas maksimal 20
    const totalDays = Math.min(20, deliveryTime + extraDays);

    // ✅ Tambahkan field revisi (dengan fallback kuat)
    orderData.revisionLimit =
      orderData.revisionLimit && orderData.revisionLimit > 0
        ? orderData.revisionLimit
        : revisionNumber; // fallback ke gig

    orderData.usedRevisions = orderData.usedRevisions ?? 0;

    // 🔹 Hitung deadline untuk dispute
    if (orderData.dispute?.reportDate) {
      const deadline = new Date(orderData.dispute.reportDate);
      deadline.setHours(deadline.getHours() + 48);
      orderData.dispute.deadline = deadline;
    }

    // 🔹 Pastikan gigId dikirim sebagai string dan sertakan data tambahan
    if (orderData.gigId && typeof orderData.gigId === "object") {
      orderData.gigTitle = orderData.gigId.title;
      orderData.deliveryTime = orderData.gigId.deliveryTime;
      orderData.revisionNumber = orderData.gigId.revisionNumber;
      orderData.gigId = orderData.gigId._id;
    }

    // 🔹 Tambahkan total hari dan revisi ke response
    orderData.deliveryTime = deliveryTime;
    orderData.revisionNumber = revisionNumber;
    orderData.totalDays = totalDays;
    orderData.extraDays = extraDays;

    console.log(
      "🧾 revisionLimit:",
      orderData.revisionLimit,
      "usedRevisions:",
      orderData.usedRevisions
    );

    return res.status(200).json({
      message: "Struk order berhasil diambil",
      order: orderData,
    });
  } catch (err) {
    console.error("❌ Gagal mengambil struk order:", err);
    return res.status(500).json({ message: "Gagal mengambil data struk order" });
  }
};


// ✅ Buyer menyetujui atau menolak permintaan pengurangan revisi
export const respondRevisionUse = async (req, res) => {
  try {
    const { approve } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: "Order tidak ditemukan." });

    // Inisialisasi properti jika belum ada
    order.usedRevisions = order.usedRevisions ?? 0;
    order.revisionLimit = order.revisionLimit ?? 0;
    order.revisionRequest = order.revisionRequest || {};

    // Hanya boleh merespons jika ada revisi pending
    if (order.revisionRequest.status !== "pending") {
      return res.status(400).json({ message: "Tidak ada permintaan revisi aktif." });
    }

    if (approve) {
      if (order.usedRevisions >= order.revisionLimit) {
        return res.status(400).json({ message: "Revisi sudah habis, tidak bisa dikurangi lagi." });
      }

      order.usedRevisions += 1;
      order.revisionRequest.status = "accepted";
    } else {
      order.revisionRequest.status = "rejected";
    }

    await order.save();

    res.status(200).json({
      message: approve ? "Revisi dikurangi 1." : "Permintaan revisi ditolak.",
      order,
    });
  } catch (err) {
    console.error("❌ Error respondRevisionUse:", err);
    res.status(500).json({ message: "Gagal memproses respon revisi." });
  }
};


// ✅ Seller mengajukan permintaan pengurangan revisi
export const requestRevisionUse = async (req, res) => {
  try {
    const { role } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: "Order tidak ditemukan." });

    // Inisialisasi nilai jika belum ada
    order.usedRevisions = order.usedRevisions ?? 0;
    order.revisionLimit = order.revisionLimit ?? 0;
    order.revisionRequest = order.revisionRequest || {};

    if (role !== "seller") {
      return res.status(403).json({ message: "Hanya penjual yang dapat mengajukan revisi." });
    }

    if (order.revisionRequest.status === "pending") {
      return res.status(400).json({ message: "Masih ada permintaan revisi yang belum disetujui." });
    }

    if (order.usedRevisions >= order.revisionLimit) {
      return res.status(400).json({ message: "Semua revisi sudah digunakan." });
    }

    order.revisionRequest = {
      from: "seller",
      status: "pending",
      date: new Date(),
    };

    await order.save();

    res.status(200).json({
      message: "Permintaan revisi dikirim ke pembeli.",
      order,
    });
  } catch (err) {
    console.error("❌ Error requestRevisionUse:", err);
    res.status(500).json({ message: "Gagal mengirim permintaan revisi." });
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

    // 🔒 Hanya buyer yang boleh menyelesaikan order
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

    // 💰 Hitung fee & pendapatan
    const adminFee = order.adminFee ?? order.price * 0.12;
    const sellerRevenue = order.price - adminFee;

    // ✅ Update saldo admin
    admin.availableBalance = (admin.availableBalance ?? 0) + adminFee;
    await admin.save();

    // ✅ Update saldo seller
    seller.availableBalance = (seller.availableBalance ?? 0) + sellerRevenue;

    // 📈 Update lifetime penjualan seller (tidak akan berkurang)
    seller.lifetimeSales = (seller.lifetimeSales ?? 0) + 1;

    // 📊 Tambah poin seller
    seller.sellerPoints = (seller.sellerPoints ?? 0) + 9;

    await seller.save();

    console.log(`✅ Admin +Rp${adminFee}`);
    console.log(`✅ Seller ${seller.username} +Rp${sellerRevenue}`);
    console.log(`📈 lifetimeSales +1, sellerPoints +9`);

    // ✅ Tandai order selesai
    order.status = "completed";
    order.progressStatus = "delivered";
    order.workCompletedAt = new Date();
    order.escrowStatus = "released";
    order.escrowReleasedAt = new Date();
    order.released = true;
    await order.save();

    // 🧹 Bersihkan percakapan setelah order selesai
    await deleteConversationsByOrderId(order._id);

    // 🔹 Update level seller (jika pakai sistem level)
    await checkAndUpdateSellerLevel(order.sellerId);

    // 🔹 Tambahkan sales ke gig
    await Gig.findByIdAndUpdate(order.gigId, { $inc: { sales: 1 } });

    res.status(200).json({
      message: "✅ Order berhasil diselesaikan. Dana masuk ke saldo Seller & Admin.",
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
      const adminFee = order.adminFee ?? order.price * 0.12;
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

    const order = await Order.findById(id);
    if (!order) return next(createError(404, "Order tidak ditemukan"));

    await deleteConversationsByOrderId(order._id);

    // ⚙️ Admin menghapus order tanpa memengaruhi lifetimeSales,
    // tapi tetap bisa kurangi totalSales aktif jika masih dihitung
    const seller = await User.findById(order.sellerId);
    if (seller) {
      if (seller.totalSales && seller.totalSales > 0) {
        seller.totalSales = Math.max(0, seller.totalSales - 1);
      }
      // ⚠️ lifetimeSales & score tidak disentuh
      await seller.save();
    }

    await Order.findByIdAndDelete(id);

    res.status(200).json({
      message: "Order dihapus oleh admin tanpa memengaruhi lifetime sales.",
    });
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