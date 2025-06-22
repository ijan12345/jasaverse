import mongoose from "mongoose";
const { Schema } = mongoose;

const ReviewSchema = new Schema(
  {
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gig", // Referensi ke model Gig
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Referensi ke model User
      required: true,
    },
    star: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4, 5], // Hanya nilai 1-5 yang diperbolehkan
    },
    desc: {
      type: String,
      required: true, // Deskripsi review wajib diisi
    },
    likedUsers: {
      type: [mongoose.Schema.Types.ObjectId], // Array ID user yang memberikan like
      ref: "User",
      default: [],
    },
    dislikedUsers: {
      type: [mongoose.Schema.Types.ObjectId], // Array ID user yang memberikan dislike
      ref: "User",
      default: [],
    },
    likes: {
      type: Number,
      default: 0, // Jumlah total like
    },
    dislikes: {
      type: Number,
      default: 0, // Jumlah total dislike
    },
  },
  {
    timestamps: true, // Tambahkan createdAt & updatedAt secara otomatis
  }
);

export default mongoose.model("Review", ReviewSchema);
