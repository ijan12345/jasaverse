import mongoose from "mongoose";
import Gig from "../models/gig.model.js";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";

export const getSellerScores = async (req, res) => {
  try {
    const top10 = await User.aggregate([
      // Ambil seller saja
      { $match: { isSeller: true } },

      // Ambil gigs milik seller
      {
        $lookup: {
          from: "gigs",
          localField: "_id",
          foreignField: "userId",
          as: "gigs"
        }
      },

      // Hitung jumlah gigs
      {
        $addFields: {
          totalGigs: { $size: "$gigs" }
        }
      },

      // Ambil order completed untuk gig milik seller
      {
        $lookup: {
          from: "orders",
          let: { gigIds: "$gigs._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$gigId", "$$gigIds"] },
                    { $eq: ["$status", "completed"] }
                  ]
                }
              }
            }
          ],
          as: "completedOrders"
        }
      },

      // Hitung calculatedSales (order aktif)
      {
        $addFields: {
          calculatedSales: { $size: "$completedOrders" }
        }
      },

      // Tambah lifetimeSales default 0
      {
        $addFields: {
          lifetimeSales: { $ifNull: ["$lifetimeSales", 0] }
        }
      },

      // Hitung skor: lifetimeSales * 9 + totalGigs
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ["$lifetimeSales", 9] },
              "$totalGigs"
            ]
          }
        }
      },

      // Urutkan dari skor tertinggi
      { $sort: { score: -1 } },

      // ✅ Batasi hanya 10 orang
      { $limit: 10 },

      // Format output
      {
        $project: {
          userId: "$_id",
          username: 1,
          profileImage: "$img",
          totalGigs: 1,
          lifetimeSales: 1,
          calculatedSales: 1,
          score: 1
        }
      }
    ]);

    // Tambahkan rank manual (1–10)
    const ranked = top10.map((seller, index) => ({
      ...seller,
      rank: index + 1,
    }));

    res.status(200).json(ranked);
  } catch (err) {
    console.error("Error leaderboard:", err);
    res
      .status(500)
      .json({ message: "Gagal mengambil leaderboard", error: err.message });
  }
};
