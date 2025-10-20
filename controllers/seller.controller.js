import mongoose from "mongoose";
import Gig from "../models/gig.model.js";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";

export const getSellerScores = async (req, res) => {
  try {
    const sellers = await User.find({ isSeller: true });

    if (!sellers.length) {
      return res.status(200).json([]);
    }

    const processedSellers = await Promise.all(
      sellers.map(async (seller) => {
        const sellerId = new mongoose.Types.ObjectId(seller._id);

        // Ambil gigs aktif
        const gigs = await Gig.find({ userId: sellerId });
        const gigIds = gigs.map((gig) => gig._id);

        // Hitung sales hanya untuk tampilan live
        const calculatedSales = await Order.countDocuments({
          gigId: { $in: gigIds },
          status: "completed",
        });

        // Ambil total sales seumur hidup dari database user
        const totalSales = seller.totalSales ?? 0;

        // Hitung jumlah gigs yang dimiliki
        const ownedGigsCount = gigIds.length;

        // Skor live berdasarkan calculatedSales (bukan totalSales dari DB)
        const score = calculatedSales * 9 + ownedGigsCount;

        return {
          _id: seller._id,
          userId: seller._id,
          username: seller.username,
          profileImage: seller.img || "/img/default-profile.png",
          totalGigs: ownedGigsCount,
          totalSales,        // pakai lifetime totalSales dari DB
          calculatedSales,   // tambahkan nilai live agar frontend bisa bedakan
          score,
        };
      })
    );

    // Urutkan berdasarkan score
    const sortedSellers = processedSellers.sort((a, b) => b.score - a.score);

    // Tambahkan rank
    const rankedSellers = sortedSellers.map((seller, index) => ({
      ...seller,
      rank: index + 1,
    }));

    res.status(200).json(rankedSellers);
  } catch (err) {
    console.error("Error fetching seller scores:", err.message);
    res.status(500).json({
      message: "Gagal mengambil skor penjual",
      error: err.message,
    });
  }
};
