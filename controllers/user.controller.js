import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import { format } from "date-fns"; // Import date-fns
import { id } from "date-fns/locale"; // Import locale untuk Indonesia
import mongoose from "mongoose";
import Gig from "../models/gig.model.js";  // ✅ Tambahkan ini
import Order from "../models/order.model.js";
import Review from "../models/review.model.js"



// Fungsi untuk mendapatkan daftar pengguna (hanya untuk admin)
export const getAllUsers = async (req, res) => {
  try {
    const user = req.user; // Verifikasi token sudah dilakukan di middleware
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Akses ditolak, hanya admin yang dapat mengakses" });
    }

    // Ambil semua pengguna
    const users = await User.find(); 
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil daftar pengguna", error: err });
  }
};


export const deleteUser = async (req, res, next) => {
  try {
    // Find the user by ID
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Check if the logged-in user is trying to delete their own account
    if (req.userId !== user._id.toString()) {
      return next(createError(403, "You can delete only your account!"));
    }

    // Delete the user's orders
    await Order.deleteMany({ userId: user._id });

    // Delete the user's gigs
    await Gig.deleteMany({ userId: user._id });

    // Delete the user's reviews
    await Review.deleteMany({ userId: user._id });

    // Delete the user's conversations and messages
    await Conversation.deleteMany({ userId: user._id });
    await Message.deleteMany({ userId: user._id });

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "User and all associated data deleted successfully." });
  } catch (err) {
    res.status(500).json({
      error: "An error occurred while deleting the user",
      details: err.message,
    });
  }
};

export const getUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Format tanggal menggunakan date-fns
    const formattedDate = format(new Date(user.createdAt), "d MMMM yyyy, HH:mm:ss", { locale: id });

    res.status(200).json({
      ...user._doc, // Menyebarkan data user
      memberSince: formattedDate, // Menambahkan formatted date
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred while retrieving the user", details: err.message });
  }
};

// Fungsi untuk menyimpan URL gambar CV dan sertifikat
export const saveUserImages = async (req, res) => {
  const { userId } = req.params;
  const { cvImage, certificateImages } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.cvImage = cvImage;
    user.certificateImages = certificateImages;
    await user.save();

    res.status(200).json({ message: 'Images saved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error saving images', error });
  }
};

export const getSellerScores = async (req, res) => {
  try {
    const { id } = req.params;

    // Validasi apakah ID user valid
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID user tidak valid" });
    }

    // Cek apakah user adalah seller
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    if (!user.isSeller) {
      return res.status(400).json({ message: "User ini bukan seller." });
    }

    // Ambil semua gigs milik seller
    const gigs = await Gig.find({ userId: id });
    const gigIds = gigs.map(gig => gig._id);

    // Hitung total penjualan dari semua gigs seller
    const totalSales = await Order.countDocuments({ gigId: { $in: gigIds } });

    // Hitung jumlah gigs yang dimiliki
    const ownedGigsCount = gigIds.length;

    // Hitung skor seller
    const score = totalSales * 9 + ownedGigsCount * 1;

    // ✅ Simpan score ke database
    user.score = score;
    await user.save();

    res.status(200).json({ 
      userId: id, 
      totalGigs: ownedGigsCount, 
      totalSales, 
      score 
    });

  } catch (err) {
    console.error("Error fetching seller score:", err.message);
    res.status(500).json({ message: "Gagal mengambil skor seller", error: err.message });
  }
};

export const getBuyerRank = async (req, res, next) => {
  try {
    const users = await User.find().sort({ totalSpent: -1 }); // urutkan pembeli berdasarkan pengeluaran tertinggi
    const rankedBuyers = users.filter(user => !user.isSeller); // hanya buyer

    const userId = req.params.id;
    const rank = rankedBuyers.findIndex(user => user._id.toString() === userId) + 1;

    if (rank === 0) {
      return res.status(404).json({ rank: "Belum memiliki peringkat" });
    }

    res.status(200).json({ rank });
  } catch (err) {
    next(err);
  }
};


// 🔵 Ambil Rank User
export const getUserRank = async (req, res) => {
  try {
    const { id } = req.params;

    // Validasi apakah ID user valid
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID user tidak valid" });
    }

    // Cek apakah user adalah seller
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    if (!user.isSeller) {
      return res.status(400).json({ message: "User ini bukan seller." });
    }

    // Ambil semua seller
    const sellers = await User.find({ isSeller: true });

    // Hitung skor untuk setiap seller
    const processedSellers = await Promise.all(
      sellers.map(async (seller) => {
        const sellerId = new mongoose.Types.ObjectId(seller._id);

        // Ambil semua gigs milik seller
        const gigs = await Gig.find({ userId: sellerId });
        const gigIds = gigs.map(gig => gig._id);

        // Hitung total penjualan dari semua gigs seller
        const totalSales = await Order.countDocuments({ gigId: { $in: gigIds } });

        // Hitung jumlah gigs yang dimiliki
        const ownedGigsCount = gigIds.length;

        // Hitung skor seller
        const score = totalSales * 9 + ownedGigsCount * 4;

        return {
          _id: seller._id,
          username: seller.username,
          totalGigs: ownedGigsCount,
          totalSales,
          score,
        };
      })
    );

    // Urutkan seller berdasarkan skor tertinggi
    const sortedSellers = processedSellers.sort((a, b) => b.score - a.score);

    // Tambahkan ranking
    const rankedSellers = sortedSellers.map((seller, index) => ({
      ...seller,
      rank: index + 1, // Ranking dimulai dari 1
    }));

    // Cari rank berdasarkan ID seller
    const userRank = rankedSellers.find(seller => seller._id.toString() === id);

    if (!userRank) {
      return res.status(404).json({ message: "Seller tidak ditemukan dalam daftar peringkat." });
    }

    // ✅ Simpan rank ke database
    user.rank = userRank.rank;
    await user.save();

    res.status(200).json(userRank);
  } catch (err) {
    console.error("Error fetching user rank:", err.message);
    res.status(500).json({ message: "Gagal mengambil peringkat user", error: err.message });
  }
};


// Fungsi untuk mengambil URL gambar CV dan sertifikat
export const getUserImages = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      cvImage: user.cvImage,
      certificateImages: user.certificateImages,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving images', error });
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    // Mencari pengguna berdasarkan ID dari parameter URL
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(createError(404, "User not found")); // Menggunakan error handler
    }
    res.status(200).json(user); // Mengirimkan data pengguna sebagai respons
  } catch (err) {
    res.status(500).json({ 
      message: "Error retrieving user profile", 
      details: err.message 
    });
  }
};




