import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      required: false, // Gambar pengirim bisa kosong
    },
    imgPublicId: { type: String },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"], // Menentukan peran pengguna
      default: "buyer",
    },
    permissions: {
      type: [String], // Hak akses spesifik untuk admin
      default: [],
    },
    country: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: false,
    },
    desc: {
      type: String,
      required: false,
    },
    isSeller: {
      type: Boolean,
      default: false,
    },
    cvImage: {
      type: String, // URL atau path untuk file CV yang diunggah
       default: ""
    },
    certificateImages: {
      type: [String], // URL atau path untuk file sertifikat yang diunggah
      default: [], // Tidak wajib diisi
    },
    rank: {
      type: Number, // Rank berupa angka
      default: 0, // Default null jika belum ada rank
    },
    isAdmin: {
      type: Boolean,
      default: false, // Default false, akan di-update jika role === "admin"
    },
    score: {
      type: Number,
      default: 0, // Default score 0 saat user pertama kali mendaftar
      min: 0, // Batas minimum score agar tidak negatif
    },    
    totalPurchases: {
  type: Number,
  default: 0,
},
emailVerified: {
  type: Boolean,
  default: false,
},
balance: {
  type: Number,
  default: 0, // Default saldo 0 saat user baru dibuat
  min: 0, // Tidak boleh negatif
},


    createdAt: { 
      type: Date, 
      default: Date.now 
    },
  },
  {
    timestamps: true,
  }
);

// Middleware untuk update isAdmin berdasarkan role
userSchema.pre("save", function (next) {
  this.isAdmin = this.role === "admin";
  next();
});

export default mongoose.model("User", userSchema);
