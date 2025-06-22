import mongoose from "mongoose";
import Gig from "../models/gig.model.js";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";

export const getSellerScores = async (req, res) => {
  try {
    // Ambil semua user yang merupakan seller
    const sellers = await User.find({ isSeller: true });

    if (!sellers.length) {
      return res.status(404).json({ message: "Tidak ada seller ditemukan." });
    }

    const processedSellers = await Promise.all(
      sellers.map(async (seller) => {
        const sellerId = new mongoose.Types.ObjectId(seller._id); // Pastikan ObjectId

        // Cari semua gigs yang dimiliki seller ini
        const gigs = await Gig.find({ userId: sellerId });

        // Ambil semua gigId dari seller ini
        const gigIds = gigs.map((gig) => gig._id);

        // Hitung total sales berdasarkan order yang memiliki gigId dari seller ini
        const totalSales = await Order.countDocuments({ gigId: { $in: gigIds } });

        // Hitung jumlah gigs yang benar-benar dimiliki seller ini
        const ownedGigsCount = gigIds.length;

        // Hitung skor berdasarkan formula
        const score = totalSales * 9 + ownedGigsCount * 4;

        return {
          _id: seller._id,
          userId: seller._id,
          username: seller.username,
          profileImage: seller.img || "/img/default-profile.png", // Tambahkan foto profil
          totalGigs: ownedGigsCount,
          totalSales,
          score,
        };
      })
    );

    // **Urutkan berdasarkan skor (dari tertinggi ke terendah)**
    const sortedSellers = processedSellers.sort((a, b) => b.score - a.score);

    // **Tambahkan ranking berdasarkan posisi dalam array**
    const rankedSellers = sortedSellers.map((seller, index) => ({
      ...seller,
      rank: index + 1, // Rank dimulai dari 1
    }));

    // **Kirim semua seller (bukan hanya top 4)**
    res.status(200).json(rankedSellers);
  } catch (err) {
    console.error("Error fetching seller scores:", err.message);
    res.status(500).json({ message: "Gagal mengambil skor penjual", error: err.message });
  }
};
