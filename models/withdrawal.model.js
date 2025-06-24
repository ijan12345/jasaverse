import mongoose from "mongoose";
const { Schema } = mongoose;

const WithdrawalSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isBalanceUpdated: {
  type: Boolean,
  default: false,
},
    amount: {
      type: Number,
      required: true,
      min: 10000, // Minimum penarikan Rp10.000
    },
   method: {
  type: String,
  required: true,
  trim: true, // Supaya bebas typo spasi
},

    destination: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    note: {
      type: String,
      default: "",
    },
    payoutResponse: {
      type: Schema.Types.Mixed, // lebih fleksibel daripada Object
      default: {},
    },
  },
  {
    timestamps: true, // Otomatis membuat createdAt & updatedAt
  }
);

export default mongoose.model("Withdrawal", WithdrawalSchema);
