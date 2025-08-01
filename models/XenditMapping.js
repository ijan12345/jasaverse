// models/XenditMapping.js
import mongoose from "mongoose";

const XenditMappingSchema = new mongoose.Schema(
  {
    external_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gig",
      required: false,
       default: null,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    relatedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null, // Untuk pembayaran tambahan (extra), jika ada
    },
  },
  { timestamps: true } // Sudah mencakup createdAt dan updatedAt otomatis
);

export default mongoose.model("XenditMapping", XenditMappingSchema);
