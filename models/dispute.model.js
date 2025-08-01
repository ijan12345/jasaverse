import mongoose from "mongoose";

const DisputeSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    reason: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Yang mengajukan
    role: { type: String, enum: ["buyer", "seller"], required: true },
    status: { type: String, enum: ["open", "resolved", "rejected"], default: "open" },
    resolution: { type: String }, // Admin bisa isi ini nanti
  },
  { timestamps: true }
);

export default mongoose.model("Dispute", DisputeSchema);
