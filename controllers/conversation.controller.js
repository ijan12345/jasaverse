import mongoose from "mongoose";
import createError from "../utils/createError.js";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});
// Create a new conversation
export const createConversation = async (req, res, next) => {
  try {
    const sellerId = new mongoose.Types.ObjectId(req.isSeller ? req.userId : req.body.to);
    const buyerId = new mongoose.Types.ObjectId(req.isSeller ? req.body.to : req.userId);

    // Ambil data user untuk gambar
    const seller = await User.findById(sellerId);
    const buyer = await User.findById(buyerId);

    const newConversation = new Conversation({
      sellerId,
      buyerId,
      sellerImg: seller?.img || "/img/noavatar.jpg",
      buyerImg: buyer?.img || "/img/noavatar.jpg",
      readBySeller: req.isSeller,
      readByBuyer: !req.isSeller,
    });

    const savedConversation = await newConversation.save();
    res.status(201).send(savedConversation);
  } catch (err) {
    if (err.code === 11000) {
      return next(createError(400, "Conversation already exists!"));
    }
    next(err);
  }
};
// Update conversation (mark as read automatically)
export const updateConversation = async (req, res, next) => {
  try {
    const updatedConversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...(req.isSeller ? { readBySeller: true } : { readByBuyer: true }),
        },
      },
      { new: true }
    )
    .populate('sellerId', 'username img')
.populate('buyerId', 'username img')


    if (!updatedConversation) return next(createError(404, "Conversation not found!"));

    req.io?.emit("conversation_updated", updatedConversation);

    res.status(200).send(updatedConversation);
  } catch (err) {
    next(err);
  }
};

export const deleteAllConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({});
    const conversationIds = conversations.map(c => c._id);

    // Ambil semua pesan terkait
    const messages = await Message.find({ conversationId: { $in: conversationIds } });

    // Hapus semua file Cloudinary yang terkait
    for (const msg of messages) {
      let publicId = null;

      if (msg.filePublicId) {
        publicId = msg.filePublicId;
      } else if (msg.file?.includes("res.cloudinary.com")) {
        const parts = msg.file.split("/");
        const lastPart = parts[parts.length - 1];
        publicId = lastPart.split(".")[0];
      }

      if (publicId) {
        try {
          await cloudinary.v2.uploader.destroy(`messages/${publicId}`);
        } catch (err) {
          console.error("❌ Gagal menghapus file Cloudinary:", publicId, err.message);
        }
      }
    }

    // Hapus semua dari DB
    await Message.deleteMany({ conversationId: { $in: conversationIds } });
    await Conversation.deleteMany({});

    res.status(200).json({ message: "Semua conversation, pesan, dan file berhasil dihapus." });
  } catch (err) {
    console.error("❌ Gagal menghapus semua conversation:", err);
    next(err);
  }
};

// Get a single conversation based on sellerId & buyerId
export const getSingleConversation = async (req, res, next) => {
  try {
    const { sellerId, buyerId } = req.query;

    if (!sellerId || !buyerId) {
      return next(createError(400, "sellerId and buyerId are required"));
    }

    if (!mongoose.Types.ObjectId.isValid(sellerId) || !mongoose.Types.ObjectId.isValid(buyerId)) {
      return next(createError(400, "Invalid sellerId or buyerId"));
    }

    let conversation = await Conversation.findOne({
      sellerId: new mongoose.Types.ObjectId(sellerId),
      buyerId: new mongoose.Types.ObjectId(buyerId),
    })
      .populate('sellerId', 'username img')
.populate('buyerId', 'username img')


    // Jika percakapan belum ada, buat percakapan baru
    if (!conversation) {
const seller = await User.findById(sellerId);
const buyer = await User.findById(buyerId);

conversation = new Conversation({
  sellerId,
  buyerId,
  sellerImg: seller?.img || "/img/noavatar.jpg",
  buyerImg: buyer?.img || "/img/noavatar.jpg",
  readBySeller: false,
  readByBuyer: false,
});


      await conversation.save();
    }

    res.status(200).json({
      id: conversation._id,
      sellerId: conversation.sellerId?._id || sellerId,
      sellerUsername: conversation.sellerId?.username || "Seller",
       sellerProfilePicture: conversation.sellerId?.img || "/img/noavatar.jpg",
      buyerId: conversation.buyerId?._id || buyerId,
      buyerUsername: conversation.buyerId?.username || "Buyer",
      buyerProfilePicture: conversation.buyerId?.img || "/img/noavatar.jpg",
      lastMessage: conversation.lastMessage || "",
      readBySeller: conversation.readBySeller,
      readByBuyer: conversation.readByBuyer,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

// Get all conversations for a user
export const getConversation = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
  ...(req.isSeller
    ? { sellerId: req.userId, deletedBySeller: false }
    : { buyerId: req.userId, deletedByBuyer: false }),
})

      .sort({ updatedAt: -1 })
.populate('sellerId', 'username img')
.populate('buyerId', 'username img')


    const formattedConversations = conversations
      .filter((conv) => conv.sellerId && conv.buyerId)
      .map((conv) => ({
        id: conv._id,
        sellerId: conv.sellerId._id,
        sellerUsername: conv.sellerId.username,
        sellerProfilePicture: conv.sellerImg || "/img/noavatar.jpg", 
        buyerId: conv.buyerId._id,
        buyerUsername: conv.buyerId.username,
         buyerProfilePicture: conv.buyerImg || "/img/noavatar.jpg",  
        lastMessage: conv.lastMessage,
        readBySeller: conv.readBySeller,
        readByBuyer: conv.readByBuyer,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        unread: req.isSeller ? !conv.readBySeller : !conv.readByBuyer,
      }));

    res.status(200).send(formattedConversations);
  } catch (err) {
    next(err);
  }
};

// Delete a conversation
export const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return next(createError(404, "Conversation not found!"));

    const isSeller = req.isSeller;
    const userId = req.userId;

    if (isSeller && conversation.sellerId.toString() === userId) {
      conversation.deletedBySeller = true;
    } else if (!isSeller && conversation.buyerId.toString() === userId) {
      conversation.deletedByBuyer = true;
    } else {
      return next(createError(403, "You are not authorized to delete this conversation."));
    }

    // Jika keduanya sudah hapus, maka hapus permanen
    if (conversation.deletedBySeller && conversation.deletedByBuyer) {
      const messages = await Message.find({ conversationId: conversation._id });

      for (const msg of messages) {
        let publicId = msg.filePublicId;

        if (!publicId && msg.file?.includes("res.cloudinary.com")) {
          const parts = msg.file.split("/");
          const filename = parts[parts.length - 1];
          publicId = `messages/${filename.split(".")[0]}`;
        }

        if (publicId) {
          try {
            const result = await cloudinary.v2.uploader.destroy(publicId);
            console.log("🗑️ Cloudinary deleted:", result);
          } catch (err) {
            console.error("❌ Cloudinary delete error:", publicId, err.message);
          }
        }
      }

      await Message.deleteMany({ conversationId: conversation._id });
      await conversation.deleteOne();

      return res.status(200).send({ message: "Conversation deleted permanently." });
    }

    await conversation.save();
    res.status(200).send({ message: "Conversation removed from your inbox." });
  } catch (err) {
    next(err);
  }
};
