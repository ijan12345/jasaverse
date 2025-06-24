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
      required: false,
      trim: true,
    },
    customerName: {
      type: String,
      required: false,
      trim: true,
    },
    customerAddress: {
      type: String,
      required: false,
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
    isBalanceUpdated: {
  type: Boolean,
  default: false,
},
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    midtransToken: {
      type: String,
      default: null,
    },
    midtransOrderId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
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
