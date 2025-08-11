import mongoose from "mongoose";

const RequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Judul request wajib diisi"],
      trim: true,
      maxlength: 100,
    },
    desc: {
      type: String,
      required: [true, "Deskripsi request wajib diisi"],
      maxlength: 2000,
    },
    budget: {
      type: Number,
      required: [true, "Budget wajib diisi"],
      min: 0,
    },
    deliveryTime: {
      type: Number, // Dalam satuan hari
      required: [true, "Waktu pengerjaan wajib diisi"],
      min: 1,
    },
    cover: {
      type: String, // URL ke gambar
      default: "",
    },
    coverPublicId: {
      type: String, // Public ID dari Cloudinary
      default: "",
    },
  },
  {
    timestamps: true, // createdAt dan updatedAt otomatis
  }
);

export default mongoose.model("Request", RequestSchema);
