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
      required: false,
    },
    img: {
      type: String,
      required: false,
    },
    nimImage: { type: String, required: false },
nimPublicId: { type: String },
faculty: { type: String, required: false },
    imgPublicId: { type: String },
    cvPublicId: { type: String },
   
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },
    // 🎯 Sistem Level & Slot Gig
level: {
  type: Number,
  default: 1, // Level awal
},
unlockedSlots: {
  type: Number,
  default: 3, // 3 gig di level 1
},
totalCompletedOrders: {
  type: Number,
  default: 0,
},
averageRating: {
  type: Number,
  default: 0,
},
statusBadge: {
  type: String,
  default: null, // misal "Penjual Terpercaya"
},

    permissions: {
      type: [String],
      default: [],
    },
   address: {
  type: String,
  required: false,
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
      type: String,
      default: "",
    },
      // 🔹 Tambahkan field khusus sertifikat
    certificatePKKMB: { type: String, default: "" },
    certificatePKKMBPublicId: { type: String, default: "" },

    certificateLDKM: { type: String, default: "" },
    certificateLDKMPublicId: { type: String, default: "" },
    rank: {
      type: Number,
      default: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
        // 🔹 Tambahan untuk tracking seller
    totalSales: {
      type: Number,
      default: 0, // total jasa terjual
      min: 0,
    },
    sellerPoints: {
      type: Number,
      default: 0, // poin rank seller (posting + jualan)
      min: 0,
    },
    totalPurchases: {
      type: Number,
      default: 0,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    lastVerifiedAt: {
  type: Date,
  default: null,
},


    // 🔑 Saldo untuk sistem escrow
    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware otomatis set isAdmin saat role berubah
userSchema.pre("save", function (next) {
  this.isAdmin = this.role === "admin";
  next();
});

export default mongoose.model("User", userSchema);
