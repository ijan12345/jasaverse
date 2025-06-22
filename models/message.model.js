import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderImg: {
      type: String,
      default: "/img/noavatar.jpg",
    },
    deletedBySender: {
  type: Boolean,
  default: false,
},
deletedByReceiver: {
  type: Boolean,
  default: false,
},

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    desc: {
      type: String,
      required: true,
    },
    file: {
      type: String, // Cloudinary secure_url
    },
    filePublicId: {
      type: String, // Cloudinary public_id (untuk penghapusan)
    },
    status: {
      type: String,
      enum: ["sent", "read"],
      default: "sent",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Message", MessageSchema);
