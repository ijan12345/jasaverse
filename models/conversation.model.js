import mongoose from "mongoose";
const { Schema } = mongoose;

const ConversationSchema = new Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
     sellerImg: {
      type: String,
      default: "/img/noavatar.jpg",
    },
    buyerImg: {
      type: String,
      default: "/img/noavatar.jpg",
    },
    readBySeller: {
      type: Boolean,
      default: false, // Default unread
    },
    readByBuyer: {
      type: Boolean,
      default: false, // Default unread
    },
    deletedBySeller: {
  type: Boolean,
  default: false,
},
deletedByBuyer: {
  type: Boolean,
  default: false,
},

    lastMessage: {
      type: String,
      default: "", // Optional, default kosong
    },
  },
  {
    timestamps: true, // createdAt & updatedAt otomatis
  }
);

// Pastikan kombinasi sellerId & buyerId unik
ConversationSchema.index({ sellerId: 1, buyerId: 1 }, { unique: true });

export default mongoose.model("Conversation", ConversationSchema);
