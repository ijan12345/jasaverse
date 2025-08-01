import mongoose from "mongoose";
const { Schema } = mongoose;

const OrderSchema = new Schema(
  {
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gig",
      required: true,
      index: true,
    },
    customerEmail: {
      type: String,
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerAddress: {
      type: String,
      trim: true,
    },
    img: {
      type: String,
      default: "https://example.com/default-image.jpg",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
xenditInvoiceId: {
  type: String,
  default: null,
  index: true, // supaya mudah dicari saat webhook
},
xenditInvoiceUrl: {
  type: String,
  default: null,
},

    withdrawnAmount: {
  type: Number,
  default: 0,
},
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "failed", "canceled"],
      default: "pending",
    },

    // ESCROW FIELDS
  escrowStatus: {
  type: String,
  enum: ["held", "released", "refunded"], // ✅ ditambahkan
  default: "held",
},
    escrowReleasedAt: {
      type: Date,
      default: null,
    },
    refundedAt: { // ✅ tambahan baru
  type: Date,
  default: null,
},
    sellerAccepted: {
      type: Boolean,
      default: false,
    },
    sellerAcceptedAt: {
      type: Date,
      default: null,
    },
    buyerConfirmed: {
      type: Boolean,
      default: false,
    },
    extraRequest: {
  description: { type: String },
  amount: { type: Number },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'paid'], default: 'pending' },
},
dispute: {
  reportedBy: String, // buyerId
  reason: String,
  reportDate: Date,
  sellerResponse: String,
  sellerRespondedAt: Date,
  resolved: Boolean,
  resolutionNote: String,
  resolvedBy: String, // adminId
  status: { type: String, enum: ['none', 'disputed', 'under_review', 'resolved'], default: 'none' },
},
workStartedAt: { type: Date },
workCompletedAt: { type: Date },
progressStatus: {
  type: String,
  enum: [
    "awaiting_seller_acceptance",
    "accepted",
    "in_progress",
    "revision_requested",
    "extra_revision_requested",
    "extra_revision_paid",
    "extra_paid", // ✅ Tambahkan ini agar validasi tidak error
    "delivered",
    "seller_refunded",
  ],
  default: "awaiting_seller_acceptance",
},

extraPayments: [
  {
    token: String,
    orderId: String,
    amount: Number,
    description: String,
    status: { type: String, default: "pending" },
  }
],



    // SYSTEM FIELDS
    isBalanceUpdated: {
      type: Boolean,
      default: false,
    },
    released: {
      type: Boolean,
      default: false,
    },
    isWithdrawn: {
      type: Boolean,
      default: false,
    },
    hasDispute: {
      type: Boolean,
      default: false,
    },

    adminFee: {
      type: Number,
      required: true,
      default: 0,
    },
    payment_intent: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Cegah duplikat order dengan gigId & buyerId yang status-nya masih pending
OrderSchema.index(
  { gigId: 1, buyerId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

export default mongoose.model("Order", OrderSchema);
