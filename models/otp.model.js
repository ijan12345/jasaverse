import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: { type: String, required: true },
    code: { type: String, required: true },
    type: { type: String, enum: ["email"], required: true },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    },
    userData: {
      type: Object, // ✅ Tambahkan ini
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("OtpVerification", otpSchema);
