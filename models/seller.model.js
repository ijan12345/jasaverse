import mongoose from "mongoose";

const SellerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    gigs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Gig" }],
    totalSales: { type: Number, default: 0 }, // Jumlah total penjualan seller
    score: { type: Number, default: 0 }, // Skor berdasarkan perhitungan tertentu
    rank: { type: Number, default: null }, // Peringkat seller
  },
  { timestamps: true }
);

export default mongoose.model("Seller", SellerSchema);
