import Offer from "../models/offer.model.js";
import Request from "../models/request.model.js";
import Gig from "../models/gig.model.js";

// Seller kirim penawaran
export const createOffer = async (req, res) => {
  try {
    const { requestId, gigId, buyerId } = req.body;

    // Cek apakah gig ada
    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ message: "Gig tidak ditemukan" });

    // ✅ 1️⃣ Batasi maksimal 15 penawaran per request
    const totalOffers = await Offer.countDocuments({ requestId });
    if (totalOffers >= 15) {
      return res.status(400).json({
        message: "Penawaran untuk permintaan ini sudah mencapai batas maksimal (15).",
      });
    }

    // ✅ 2️⃣ Cek apakah seller sudah pernah mengirim penawaran untuk request ini
    const sellerAlreadyOffered = await Offer.findOne({
      requestId,
      sellerId: req.userId,
    });

    if (sellerAlreadyOffered) {
      return res.status(400).json({
        message: "Kamu sudah mengirim penawaran untuk permintaan ini.",
      });
    }

    // ✅ Kalau semua lolos, buat penawaran baru
    const newOffer = new Offer({
      requestId,
      gigId,
      buyerId,
      sellerId: req.userId, // dari middleware auth
      price: gig.price,
    });

    await newOffer.save();
    res.status(201).json(newOffer);
  } catch (err) {
    console.error("❌ Error createOffer:", err);
    res.status(500).json({ message: err.message });
  }
};


export const getMyGigs = async (req, res) => {
  try {
    const gigs = await Gig.find({ userId: req.userId });
    res.status(200).json(gigs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Seller lihat semua penawaran yang dia kirim
export const getMyOffers = async (req, res) => {
  try {
    const filter = { sellerId: req.userId };

    // Kalau dikirim query requestId, kita filter
    if (req.query.requestId) {
      filter.requestId = req.query.requestId;
    }

    const offers = await Offer.find(filter)
      .populate("gigId", "_id title deliveryTime")
      .populate("requestId", "_id title")
      .populate("buyerId", "_id username") // ✅ kirim id + username
      .populate("sellerId", "_id username") // ✅ kirim id + username
      .sort({ createdAt: -1 })
      .limit(10);

    const formatted = offers.map(o => ({
      _id: o._id,
      gigId: o.gigId?._id,
      gigTitle: o.gigId?.title,
      requestId: o.requestId?._id,
      requestTitle: o.requestId?.title,
      price: o.price,
      status: o.status,
      createdAt: o.createdAt,
      buyerId: o.buyerId?._id || null,         // ✅ tambahkan
      buyerUsername: o.buyerId?.username || null,
      sellerId: o.sellerId?._id || null,       // ✅ tambahkan
      sellerUsername: o.sellerId?.username || null,
      deliveryTime: o.gigId?.deliveryTime || null,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.offerId);
    if (!offer) {
      return res.status(404).json({ message: "Penawaran tidak ditemukan" });
    }

    if (offer.sellerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Tidak diizinkan menghapus penawaran ini" });
    }

    await offer.deleteOne();
    res.json({ message: "Penawaran berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Buyer lihat penawaran masuk
// controllers/offer.controller.js
export const getIncomingOffers = async (req, res) => {
  try {
    const { buyerId } = req.params;
    const offers = await Offer.find({ buyerId })
      .populate({
        path: "gigId",
        select: "title desc cover deliveryTime"
      })
      .populate({
        path: "sellerId",
        select: "username"
      })
      .sort({ createdAt: -1 });

    const formatted = offers.map(o => ({
      _id: o._id,
      gigTitle: o.gigId?.title || "Gig tidak tersedia",
      gigDesc: o.gigId?.desc || "",
      gigCover: o.gigId?.cover || "",
      price: o.price,
      sellerName: o.sellerId?.username || "Penjual",
      deliveryTime: o.gigId?.deliveryTime || null,
      note: o.note || "",
      createdAt: o.createdAt,
      status: o.status
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("Error getIncomingOffers:", err);
    res.status(500).json({ message: "Gagal memuat penawaran masuk" });
  }
};

export const getOffersByRequestId = async (req, res) => {
  try {
    const offers = await Offer.find({ requestId: req.params.requestId })
      .populate("gigId", "title desc cover price deliveryTime")
      .populate("sellerId", "username");
    res.status(200).json(offers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// Buyer terima atau tolak penawaran
// controllers/offer.controller.js (perbaikan)
export const updateOfferStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    // <-- gunakan offerId sesuai router
    const offer = await Offer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: "Penawaran tidak ditemukan" });

    if (offer.buyerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Tidak diizinkan" });
    }

    offer.status = status;
    await offer.save();

    res.json(offer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

