import createError from "../utils/createError.js";
import Review from "../models/review.model.js";
import Gig from "../models/gig.model.js";
import Order from "../models/order.model.js";

export const createReview = async (req, res, next) => {
  try {
    const { gigId, desc, star } = req.body;

    // 1. Pastikan belum pernah review
    const existingReview = await Review.findOne({
      gigId,
      userId: req.userId,
    });

    if (existingReview) {
      return next(createError(403, "❗ Kamu sudah memberi ulasan untuk gig ini"));
    }

    // 2. Cek apakah user adalah pembeli dengan order aktif
    const validOrder = await Order.findOne({
      gigId,
      buyerId: req.userId,
      status: { $in: ["pending", "in_progress", "accepted"] },
    });

    // 3. Cek apakah user adalah pemilik gig
    const gig = await Gig.findById(gigId);
    if (!gig) return next(createError(404, "Gig tidak ditemukan"));

    const isOwner = gig.userId.toString() === req.userId.toString();

    // 4. Hanya boleh lanjut jika pembeli aktif atau pemilik gig
    if (!validOrder && !isOwner) {
      return next(createError(403, "❌ Hanya pembeli aktif atau pemilik gig yang dapat memberi ulasan"));
    }

    const newReview = new Review({
      userId: req.userId,
      gigId,
      desc,
      star,
    });

    const savedReview = await newReview.save();

    await Gig.findByIdAndUpdate(gigId, {
      $inc: { totalStars: star, starNumber: 1 },
    });

    res.status(201).send(savedReview);
  } catch (err) {
    next(err);
  }
};

export const reportReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) return res.status(404).json({ message: "Review not found" });

    if (!Array.isArray(review.reportedInfo)) {
      review.reportedInfo = [];
    }

    const alreadyReported = review.reportedInfo.some(info =>
      info.user.toString() === req.userId.toString()
    );

    if (alreadyReported) {
      return res.status(400).json({ message: "Kamu sudah melaporkan review ini" });
    }

    if (!req.body.reason || req.body.reason.trim() === "") {
      return res.status(400).json({ message: "Alasan pelaporan wajib diisi" });
    }

    review.reported = true;
    review.reportedInfo.push({
      user: req.userId,
      reason: req.body.reason,
    });

    await review.save();

    res.status(200).json({ success: true, message: "Review telah dilaporkan" });
  } catch (err) {
    console.error("Gagal melaporkan review:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const normalizeReportedReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.reported = false;
    review.reportedBy = [];
    review.reportReason = "";
    await review.save();

    res.status(200).json({ success: true, message: "Review dinormalkan" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getReportedReviews = async (req, res) => {
  try {
  const reviews = await Review.find({ reported: true })
   .populate("userId")
  .populate("gigId", "title")
    .populate("userId gigId reportedInfo.user")
  .sort({ updatedAt: -1 });
    res.status(200).json(reviews);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ gigId: req.params.gigId })
      .populate({ path: "gigId", select: "sellerId" }) // Pastikan ini ada

    console.log("Fetched Reviews:", reviews); // Tambahkan log

    res.status(200).send(reviews);
  } catch (err) {
    next(err);
  }
};


export const deleteReview = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Dapatkan nilai bintang (star) dari review yang akan dihapus
    const starToRemove = review.star;

    // Hapus review
    await Review.findByIdAndDelete(reviewId);

    // Update totalStars dan starNumber pada Gig
    await Gig.findByIdAndUpdate(review.gigId, {
      $inc: {
        totalStars: -starToRemove,  // Kurangi totalStars dengan nilai bintang yang dihapus
        starNumber: -1,             // Kurangi jumlah review
      },
    });

    res.status(200).json({ success: true, message: "Review deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const likeReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const userId = req.userId.toString();
    let message = "";

    if (review.likedUsers.includes(userId)) {
      // Jika sudah like, maka unlike
      review.likedUsers = review.likedUsers.filter(id => id.toString() !== userId);
      review.likes -= 1;
      message = "Like removed";
    } else {
      // Hapus dari dislikedUsers jika ada
      review.dislikedUsers = review.dislikedUsers.filter(id => id.toString() !== userId);
      review.likedUsers.push(userId);
      review.likes += 1;
      review.dislikes = review.dislikedUsers.length; // Pastikan dislikes dihitung ulang
      message = "Review liked";
    }

    await review.save();
    res.status(200).json({ success: true, message, review });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const dislikeReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const userId = req.userId.toString();
    let message = "";

    if (review.dislikedUsers.includes(userId)) {
      // Jika sudah dislike, maka undislike
      review.dislikedUsers = review.dislikedUsers.filter(id => id.toString() !== userId);
      review.dislikes -= 1;
      message = "Dislike removed";
    } else {
      // Hapus dari likedUsers jika ada
      review.likedUsers = review.likedUsers.filter(id => id.toString() !== userId);
      review.dislikedUsers.push(userId);
      review.dislikes += 1;
      review.likes = review.likedUsers.length; // Pastikan likes dihitung ulang
      message = "Review disliked";
    }

    await review.save();
    res.status(200).json({ success: true, message, review });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
