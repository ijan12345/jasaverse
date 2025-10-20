import mongoose from "mongoose";

const rewardRedemptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rewardType: { type: String, default: "DANA" },
    amount: { type: Number, required: true },
    pointsUsed: { type: Number, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },

    // 🔹 Tambahan informasi user
    phone: { type: String },
    email: { type: String },
    address: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("RewardRedemption", rewardRedemptionSchema);
