import Gig from "../models/gig.model.js";
import Order from "../models/order.model.js";
import Review from "../models/review.model.js";
import createError from "../utils/createError.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js"

// Fungsi untuk membuat Gig
export const createGig = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) return next(createError(401, "You must be logged in"));

    const decoded = jwt.verify(token, process.env.JWT_KEY);
    req.userId = decoded.id;

    if (!decoded.isSeller) return next(createError(403, "Only sellers can create a gig!"));

    const { cover } = req.body;

   const newGig = new Gig({
  ...req.body,
  userId: new mongoose.Types.ObjectId(req.userId), // ✅ pastikan ObjectId
});


    const savedGig = await newGig.save();
    res.status(201).json(savedGig);
  } catch (err) {
    next(err);
  }
};


// Fungsi untuk menghapus Gig
export const deleteGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));

    // Ambil informasi user berdasarkan userId
    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    // Cek apakah user adalah pemilik gig atau admin
    if (gig.userId.toString() !== req.userId.toString() && user.role !== "admin") {
      return next(createError(403, "You can only delete your own gig unless you are an admin!"));
    }

    await Gig.findByIdAndDelete(req.params.id);
    res.status(200).send("Gig has been deleted!");
  } catch (err) {
    next(err);
  }
};



export const getGig = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(createError(400, "Invalid Gig ID"));
    }

    const gig = await Gig.findById(req.params.id).populate("userId", "username");

    if (!gig) return next(createError(404, "Gig not found!"));

    // Pastikan userId dikirim sebagai string ke frontend
    const gigWithUserIdAsString = {
      ...gig.toObject(),
      userId: gig.userId?._id.toString(), // Konversi userId ke string
    };

    res.status(200).json(gigWithUserIdAsString);
  } catch (err) {
    console.error("Error in getGig:", err.message);
    next(err);
  }
};

// Fungsi untuk mendapatkan Gig berdasarkan ID
export const getGigs = async (req, res, next) => {
  const q = req.query;
  const filters = {
    ...(q.userId && { userId: new mongoose.Types.ObjectId(q.userId) }), // Konversi ke ObjectId
    ...(q.category && { category: q.category }),
    ...((q.min || q.max) && {
      price: {
        ...(q.min && { $gt: q.min }),
        ...(q.max && { $lt: q.max }),
      },
    }),
    ...(q.search && { title: { $regex: q.search, $options: "i" } }),
  };

  try {
    const gigs = await Gig.find(filters)
      .populate("userId", "username")
      .sort({ [q.sort]: -1 });

const updatedGigs = await Promise.all(
  gigs.map(async (gig) => {
    return { ...gig.toObject() }; // gunakan nilai sales yang disimpan di DB

  })
);


    res.status(200).json(updatedGigs);
  } catch (err) {
    console.error("Error in getGigs:", err.message);
    next(err);
  }
};
// Fungsi untuk memperbarui Gig
export const updateGig = async (req, res, next) => {
  const gigId = req.params.id;

  try {
    if (req.body.price && req.body.price < 0) {
      return res.status(400).json({ message: "Harga harus berupa angka positif" });
    }

    const updatedGig = await Gig.findByIdAndUpdate(
      gigId,
      { $set: req.body },
      { new: true }
    );

    if (!updatedGig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    res.status(200).json(updatedGig);
  } catch (error) {
    console.error("Error updating gig:", error);
    res.status(500).json({ message: "Failed to update gig", error: error.message });
  }
};


// Fungsi untuk membuat review
export const createReview = async (req, res, next) => {
  const { gigId, description, star } = req.body;
  const currentUserId = req.userId;

  try {
    const gig = await Gig.findById(gigId);
    if (!gig) return next(createError(404, "Gig not found!"));

    const isPurchased = gig.purchasedBy.includes(currentUserId);
    const isOwner = gig.userId.toString() === currentUserId.toString();

    if (!isPurchased && !isOwner) {
      return next(createError(403, "You must purchase the gig or be the owner to review"));
    }

    const review = new Review({
      gigId,
      userId: currentUserId,
      description,
      star,
    });

    await review.save();
    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
};
// Mendapatkan total penjualan berdasarkan userId
export const getTotalSales = async (req, res) => {
  const userId = req.params.userId;

  try {
    const gigs = await Gig.find({ userId });
    const totalSales = gigs.reduce((sum, gig) => sum + (gig.sales || 0), 0);
    
    res.json({ totalSales });
  } catch (err) {
    console.error("Error fetching total sales:", err);
    res.status(500).json({ message: "Error fetching total sales" });
  }
};


// Fungsi untuk mendapatkan jumlah Gig yang dimiliki berdasarkan userId
export const getOwnedGigs = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const ownedGigs = await Gig.find({ userId });

    if (!ownedGigs || ownedGigs.length === 0) {
      return res.json({ ownedGigsCount: 0 });
    }

    res.json({ ownedGigsCount: ownedGigs.length });
  } catch (err) {
    console.error("Error fetching owned gigs:", err);
    next(err);
  }
};
