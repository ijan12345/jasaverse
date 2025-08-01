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
      required: false,
    },
    imgPublicId: { type: String },
    cvPublicId: { type: String },
    certificatePublicIds: [{ type: String }],
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer",
    },
    permissions: {
      type: [String],
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
      type: String,
      default: "",
    },
    certificateImages: {
      type: [String],
      default: [],
    },
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
