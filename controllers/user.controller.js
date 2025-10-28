import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import { format } from "date-fns"; // Import date-fns
import { id } from "date-fns/locale"; // Import locale untuk Indonesia
import mongoose from "mongoose";
import Gig from "../models/gig.model.js";  // ✅ Tambahkan ini
import Order from "../models/order.model.js";
import Review from "../models/review.model.js"
import Message from "../models/message.model.js";
import cloudinary from "../utils/cloudinary.js";
import Conversation from "../models/conversation.model.js";
import Blacklist from "../models/blacklist.model.js"; // ❗ INI HARUS ADA

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
export const checkAndUpdateSellerLevel = async (sellerId) => {
  const seller = await User.findById(sellerId);
  if (!seller || !seller.isSeller) return;

  const completedOrders = await Order.countDocuments({
    sellerId,
    status: "completed",
  });

  const reviews = await Review.find({ sellerId });
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.star, 0) / reviews.length
      : 0;

  seller.totalCompletedOrders = completedOrders;
  seller.averageRating = avgRating;

  // 🎯 Aturan naik level
  if (seller.level === 1 && completedOrders >= 5 && avgRating >= 4.7) {
    seller.level = 2;
    seller.unlockedSlots = Math.max(seller.unlockedSlots, 7);
    seller.statusBadge = "Penjual Terpercaya";
  } else if (seller.level === 2 && completedOrders >= 20 && avgRating >= 4.8) {
    seller.level = 3;
    seller.unlockedSlots = Math.max(seller.unlockedSlots, 10);
    seller.statusBadge = "Penjual Elite";
  } else if (avgRating < 4.0) {
    seller.statusBadge = null; // kehilangan badge tapi slot tetap
  }

  await seller.save();
};

export const getSellerLeaderboard = async (req, res) => {
  try {
    // 1. Ambil semua data mentah yang relevan
    //    .lean() membuatnya lebih cepat karena hanya mengambil data JSON
    const users = await User.find({ isSeller: true })
      .select("_id username img")
      .lean();
      
    const gigs = await Gig.find().select("userId").lean();
    const orders = await Order.find({ status: "completed" })
      .select("sellerId")
      .lean();

    // 2. Ubah data mentah menjadi Peta (Map) untuk pencarian cepat
    //    Ini jauh lebih cepat daripada query database di dalam loop
    
    const gigCounts = {}; // Peta: userId -> jumlah gig
    for (const gig of gigs) {
      const userId = gig.userId.toString();
      gigCounts[userId] = (gigCounts[userId] || 0) + 1;
    }

    const orderCounts = {}; // Peta: sellerId -> jumlah order
    for (const order of orders) {
      const sellerId = order.sellerId.toString();
      orderCounts[sellerId] = (orderCounts[sellerId] || 0) + 1;
    }

    // 3. Proses data di memori server
    const processedSellers = users.map((user) => {
      const userId = user._id.toString();
      
      const totalGigs = gigCounts[userId] || 0;
      const totalSales = orderCounts[userId] || 0;
      const score = totalSales * 9 + totalGigs; // Logika skor Anda

      return {
        userId: user._id,
        username: user.username,
        profileImage: user.img || "https://via.placeholder.com/28",
        totalSales,
        totalGigs,
        score,
      };
    });

    // 4. Urutkan, ambil 5 teratas, dan kirim
    const sortedSellers = processedSellers
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Hanya kirim 5 teratas

    res.status(200).json(sortedSellers);
  } catch (err) {
    console.error("Error in getSellerLeaderboard:", err);
    res.status(500).json({ message: "Gagal memuat leaderboard" });
  }
};
export const getSellerLevelInfo = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "level unlockedSlots totalCompletedOrders averageRating statusBadge"
    );
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil info level", error: err.message });
  }
};


export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found"));

    if (req.userId !== user._id.toString() && req.user.role !== "admin") {
      return next(createError(403, "Unauthorized access"));
    }

    // 🔴 Hapus profil image
    if (user.imgPublicId) {
      await cloudinary.uploader.destroy(user.imgPublicId);
    }

    // 🔴 Hapus CV
    if (user.cvPublicId) {
      await cloudinary.uploader.destroy(user.cvPublicId);
    }

    // 🔴 Hapus Sertifikat
    if (Array.isArray(user.certificatePublicIds)) {
      for (const publicId of user.certificatePublicIds) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    // Hapus semua data terkait
    await Order.deleteMany({ userId: user._id });
    await Gig.deleteMany({ userId: user._id });
    await Review.deleteMany({ userId: user._id });
    await Conversation.deleteMany({ userId: user._id });
    await Message.deleteMany({ userId: user._id });

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "User dan semua data terkait berhasil dihapus." });
  } catch (err) {
    res.status(500).json({
      error: "Gagal menghapus user",
      details: err.message,
    });
  }
};


// user.controller.js
// 📊 GET /users/faculty-rank
export const getFacultyRanks = async (req, res) => {
  try {
    // Ambil semua user yang punya fakultas
    const users = await User.find({ faculty: { $exists: true, $ne: "" } });
    const gigs = await Gig.find();
    const orders = await Order.find({ status: "completed" });

    // Map fakultas → total skor kumulatif
    const facultyScores = {};

    for (const user of users) {
      // Semua gig & order dari seller ini
      const userGigs = gigs.filter((g) => g.userId.toString() === user._id.toString());
      const userOrders = orders.filter((o) => o.sellerId.toString() === user._id.toString());

      const totalGigs = userGigs.length;
      const totalSales = userOrders.length;
      const score = totalSales * 9 + totalGigs; // 💡 sama persis seperti SellerScoresScreen

      if (!facultyScores[user.faculty]) {
        facultyScores[user.faculty] = 0;
      }
      facultyScores[user.faculty] += score;
    }

    // Ubah ke bentuk array dan urutkan
    const rankedFaculties = Object.entries(facultyScores)
      .map(([faculty, score]) => ({ faculty, score }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    res.status(200).json(rankedFaculties);
  } catch (err) {
    console.error("Error calculating faculty ranks:", err);
    res.status(500).json({ message: "Error calculating faculty ranks" });
  }
};




export const getUserBalance = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return next(createError(404, "User tidak ditemukan"));

    res.status(200).json({
      availableBalance: user.availableBalance ?? 0,
      pendingBalance: user.pendingBalance ?? 0,
    });
  } catch (err) {
    next(err);
  }
};
export const changeEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    const userId = req.params.id;

    // Cek user ada
    const user = await User.findById(userId);
    if (!user) return next(createError(404, "User tidak ditemukan"));

    // Cek email sudah dipakai
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return next(createError(400, "Email sudah digunakan"));

    // Update email, set verified false
    user.email = email;
    user.emailVerified = false;
    user.lastVerifiedAt = null;
    await user.save();

    // Buat OTP verifikasi
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    await OtpVerification.findOneAndUpdate(
      { email, type: "verify" },
      { code: otpCode, expiresAt },
      { upsert: true, new: true }
    );

    // Kirim OTP ke email baru
    await sendEmailOtp(email, otpCode);

    res.status(200).json({
      message: "Email berhasil diubah, OTP dikirim ke email baru",
    });
  } catch (err) {
    next(err);
  }
};

// ✅ Cek ketersediaan username
export const checkUsername = async (req, res, next) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ available: false, message: "Username wajib diisi" });
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(200).json({ available: false, message: "Username sudah digunakan" });
    }

    res.status(200).json({ available: true, message: "Username tersedia" });
  } catch (err) {
    next(err);
  }
};


export const changePhone = async (req, res, next) => {
  try {
    const { phone } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User tidak ditemukan"));

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) return next(createError(400, "Nomor sudah digunakan"));

    user.phone = phone;
    await user.save();

    res.status(200).json({ message: "Nomor telepon berhasil diubah" });
  } catch (err) {
    next(err);
  }
};

// controllers/blacklist.controller.js

// Ambil semua email yang diblacklist
export const getBlacklistedEmails = async (req, res) => {
  try {
    const blacklist = await Blacklist.find({});
    res.status(200).json(blacklist);
  } catch (err) {
    res.status(500).json({ message: "Gagal mengambil data blacklist." });
  }
};

// Tambah email ke blacklist
export const addEmailToBlacklist = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email wajib diisi." });

  const exists = await Blacklist.findOne({ email });
  if (exists) return res.status(400).json({ message: "Email sudah diblacklist." });

  const result = await new Blacklist({ email }).save();
  res.status(201).json(result);
};

// Hapus email dari blacklist
export const removeEmailFromBlacklist = async (req, res) => {
  const { email } = req.params;
  await Blacklist.deleteOne({ email });
  res.status(200).json({ message: "Email berhasil dihapus." });
};

export const getUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Logika reset verifikasi jika lewat 24 jam
    if (user.emailVerified && user.lastVerifiedAt) {
      const diff = Date.now() - new Date(user.lastVerifiedAt).getTime();
      const oneDay = 24 * 60 * 60 * 1000;

      if (diff > oneDay) {
        user.emailVerified = false;
        await user.save();
      }
    }

    // Format tanggal akun dibuat
    const formattedDate = format(
      new Date(user.createdAt),
      "d MMMM yyyy, HH:mm:ss",
      { locale: id }
    );

    res.status(200).json({
      ...user._doc,
      memberSince: formattedDate,
      availableBalance: user.availableBalance,
      pendingBalance: user.pendingBalance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while retrieving the user",
      details: err.message,
    });
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
    const gigIds = gigs.map((gig) => gig._id);

    // Hitung total penjualan berdasarkan order aktif (untuk tampilan)
    const calculatedSales = await Order.countDocuments({ gigId: { $in: gigIds } });

    // Hitung jumlah gigs yang dimiliki
    const ownedGigsCount = gigIds.length;

    // Hitung skor seller (untuk leaderboard)
    const score = calculatedSales * 9 + ownedGigsCount * 1;

    // ✅ Simpan hanya score, tanpa ubah totalSales di database
    user.score = score;
    await user.save();

    // ✅ Kirim hasil hitung ke frontend tanpa mengubah database totalSales
    res.status(200).json({
      userId: id,
      totalGigs: ownedGigsCount,
      totalSales: user.totalSales, // tetap gunakan nilai di DB
      calculatedSales, // tampilkan hasil hitung live
      score,
    });
  } catch (err) {
    console.error("Error fetching seller score:", err.message);
    res.status(500).json({
      message: "Gagal mengambil skor seller",
      error: err.message,
    });
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

    // Validasi ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID user tidak valid" });
    }

    // Ambil user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    if (!user.isSeller) {
      return res.status(400).json({ message: "User ini bukan seller." });
    }

    // Ambil semua seller
    const sellers = await User.find({ isSeller: true });

    // Hitung skor untuk tiap seller
    const processedSellers = await Promise.all(
      sellers.map(async (seller) => {
        const sellerId = new mongoose.Types.ObjectId(seller._id);

        // Ambil semua gigs milik seller
        const gigs = await Gig.find({ userId: sellerId });
        const gigIds = gigs.map(gig => gig._id);

        // Hitung total sales dengan status completed
        const totalSales = await Order.countDocuments({
          gigId: { $in: gigIds },
          status: "completed",
        });

        // Hitung jumlah gigs
        const ownedGigsCount = gigIds.length;

        // Hitung skor
        const score = totalSales * 9 + ownedGigsCount * 1;

        return {
          _id: seller._id,
          username: seller.username,
          totalGigs: ownedGigsCount,
          totalSales,
          score,
        };
      })
    );

    // Urutkan berdasarkan skor tertinggi
    const sortedSellers = processedSellers.sort((a, b) => b.score - a.score);

    // Tambahkan ranking
    const rankedSellers = sortedSellers.map((seller, index) => ({
      ...seller,
      rank: index + 1,
    }));

    // Temukan ranking untuk user yang diminta
    const userRank = rankedSellers.find(seller => seller._id.toString() === id);

    if (!userRank) {
      return res.status(404).json({ message: "Seller tidak ditemukan dalam daftar peringkat." });
    }

    // Simpan rank dan score ke database
    user.rank = userRank.rank;
    user.score = userRank.score;
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

export const getUserProfileFromToken = async (req, res, next) => {
  try {
    const userId = req.userId; // ambil dari token
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found"));

    // 🔹 Hitung skor jika user adalah seller
    if (user.isSeller) {
      const gigs = await Gig.find({ userId: user._id });
      const gigIds = gigs.map(g => g._id);
      const totalSales = await Order.countDocuments({ gigId: { $in: gigIds }, status: "completed" });
      const ownedGigsCount = gigIds.length;
      user.score = totalSales * 9 + ownedGigsCount * 1; // logika sama seperti getUserRank
      await user.save();
    }

    res.status(200).json({
      ...user._doc,
      availableBalance: user.availableBalance,
      pendingBalance: user.pendingBalance,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error retrieving user profile",
      details: err.message,
    });
  }
};


export const getUserEscrowBalance = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Cari user, pastikan ada
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    // Ambil semua order yang sudah selesai dan belum ditarik
    const completedOrders = await Order.find({
      sellerId: id,
      status: "completed",
      isWithdrawn: { $ne: true },
    });

    const earnings = completedOrders.reduce((total, order) => {
      const adminFee = order.adminFee ?? order.price * 0.12; // 2% default fee
      return total + (order.price - adminFee);
    }, 0);

    res.status(200).json({
      availableBalance: earnings,
      pendingBalance: 0, // bisa dihitung jika kamu pakai status "processing" misalnya
    });
  } catch (err) {
    console.error("❌ Gagal hitung saldo escrow:", err);
    res.status(500).json({ message: "Gagal mengambil saldo" });
  }
};

export const updateBalance = async (req, res, next) => {
  try {
    const { userId, availableBalance, pendingBalance } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    // ❌ Jangan timpa dengan nilai kosong jika tidak dikirim
    if (typeof availableBalance === "number") {
      user.availableBalance = availableBalance;
    }
    if (typeof pendingBalance === "number") {
      user.pendingBalance = pendingBalance;
    }

    await user.save();

    res.status(200).json({ message: "Saldo berhasil diupdate", user });
  } catch (err) {
    next(err);
  }
};

export const withdrawBalance = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const userId = req.userId;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Jumlah penarikan tidak valid" });
    }

    const orders = await Order.find({
      sellerId: userId,
      status: "completed",
      isWithdrawn: { $ne: true },
    });

    const sortedOrders = orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let remaining = amount;
    const updatedOrderIds = [];

    for (const order of sortedOrders) {
      const adminFee = order.adminFee ?? order.price * 0.12;
      const netAmount = order.price - adminFee;

      if (remaining >= netAmount) {
        order.isWithdrawn = true;
        await order.save();
        remaining -= netAmount;
        updatedOrderIds.push(order._id);
      } else {
        break;
      }
    }

    if (updatedOrderIds.length === 0) {
      return res.status(400).json({ message: "Saldo tidak mencukupi atau tidak dapat ditarik" });
    }

    const amountWithdrawn = amount - remaining;

    // ✅ Update availableBalance user
    const user = await User.findById(userId);
    if (user) {
      user.availableBalance = (user.availableBalance ?? 0) - amountWithdrawn;
      await user.save();
    }

    res.status(200).json({
      message: "Penarikan berhasil",
      amountWithdrawn,
      withdrawnOrders: updatedOrderIds,
    });
  } catch (err) {
    next(err);
  }
};
