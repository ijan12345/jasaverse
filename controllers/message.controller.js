import createError from "../utils/createError.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import cloudinary from "cloudinary";




// Create message
// Create message untuk Firebase
export const createMessage = async (req, res, next) => {
  try {
    const {
conversationId,
  desc,
  senderName = "",
  senderImg = "",
  file = null,
  filePublicId = null,
} = req.body;

    // Validasi conversationId
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return next(createError(400, "Invalid conversation ID"));
    }

const newMessage = new Message({
  conversationId,
  userId: req.userId,
  desc,
  senderImg,
  senderName,
  status: "sent",
  file,
  filePublicId, // ✅ disimpan di sini
});
    const savedMessage = await newMessage.save();

    const updatedConversation = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          readBySeller: req.isSeller,
          readByBuyer: !req.isSeller,
          lastMessage: desc || (file ? "📎 File terkirim" : ""),
        },
      },
      { new: true }
    );

    if (!updatedConversation) {
      console.log("❌ Conversation tidak ditemukan:", conversationId);
      return next(createError(404, "Conversation not found"));
    }

    res.status(201).send(savedMessage);
  } catch (err) {
    next(err);
  }
};
// DELETE single message
export const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return next(createError(404, "Message not found"));

    const userId = req.userId;

    // Kalau pesan sudah dihapus oleh pengirim & penerima, hapus permanen
    if (
message.deletedBySender && message.deletedByReceiver

    ) {
      // Hapus file Cloudinary jika ada
      if (message.filePublicId) {
        try {
          await cloudinary.v2.uploader.destroy(message.filePublicId);
        } catch (err) {
          console.error("Gagal hapus file Cloudinary:", err.message);
        }
      }
      await message.deleteOne();
      return res.status(200).send({ message: "Message deleted permanently." });
    }

    // Update kolom deletedBy...
if (message.userId.toString() === userId) {
  message.deletedBySender = true;
} else {
  message.deletedByReceiver = true;
}


    await message.save();

    res.status(200).send({ message: "Message hidden for you." });
  } catch (err) {
    next(err);
  }
};
// DELETE for everyone
export const deleteMessageForEveryone = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return next(createError(404, "Message not found"));

    // Hapus file Cloudinary jika ada
    if (message.filePublicId) {
      try {
        await cloudinary.v2.uploader.destroy(message.filePublicId);
      } catch (err) {
        console.error("Cloudinary error:", err.message);
      }
    }

    await message.deleteOne();
    res.status(200).send({ message: "Message deleted for everyone." });
  } catch (err) {
    next(err);
  }
};


export const getAverageResponseTime = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Ambil semua percakapan (message) 30 hari terakhir
    const allConversations = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: THIRTY_DAYS_AGO },
        },
      },
      {
        $group: {
          _id: "$conversationId",
          messages: { $push: "$$ROOT" }
        }
      }
    ]);

    let totalDiff = 0;
    let count = 0;

    for (const convo of allConversations) {
      const messages = convo.messages.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      const buyerMsg = messages.find(m => m.userId !== userId);
      const sellerReply = messages.find(m =>
        m.userId === userId && new Date(m.createdAt) > new Date(buyerMsg?.createdAt)
      );

      if (buyerMsg && sellerReply) {
        const diff = new Date(sellerReply.createdAt) - new Date(buyerMsg.createdAt);
        totalDiff += diff;
        count++;
      }
    }

    if (count === 0) {
      return res.json({ averageResponseTime: null });
    }

    const averageMs = totalDiff / count;
    const averageMinutes = Math.round(averageMs / 60000);

    res.json({ averageResponseTime: averageMinutes });
  } catch (err) {
    next(err);
  }
};

// Get messages
// message.controller.js

export const getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ conversationId: req.params.id });

    // ❗ INI BAGIAN YANG MENYEBABKAN KONFLIK
    await Message.updateMany(
      { 
        conversationId: req.params.id, 
        read: false, 
        userId: { $ne: req.userId } 
      },
      { $set: { read: true } }
    );

    res.status(200).send(messages);
  } catch (err) {
    next(err);
  }
};

// Download file
export const downloadFile = (req, res, next) => {
  const filePath = req.params.filePath;
  const fullPath = path.join(__dirname, "..", "uploads", filePath); // Get the file from uploads folder

  if (fs.existsSync(fullPath)) {
    res.download(fullPath); // Send the file for download
  } else {
    return next(createError(404, "File not found"));
  }
};
// Update read status
export const updateReadStatus = async (req, res, next) => {
  const { id } = req.params; // Ambil ID dari URL parameter
  console.log("📩 Request update read status untuk messageId:", id);

  // Pastikan ID valid
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log("❌ Invalid message ID:", id);
    return next(createError(400, "Invalid message ID"));
  }
  const messageId = new mongoose.Types.ObjectId(id);

  try {
    // 🔍 Cari pesan berdasarkan ObjectId
    console.log("🔍 Mencari pesan dengan ID:", messageId);
    const message = await Message.findById(messageId);

    if (!message) {
      console.log("❌ Pesan tidak ditemukan untuk ID:", messageId);
      return next(createError(404, "Message not found"));
    }
    
    console.log("✅ Pesan ditemukan:", message);

    // Cek apakah user menandai pesan sendiri
    if (String(message.userId) === String(req.userId)) {
      console.log("⚠️ User mencoba menandai pesan sendiri sebagai dibaca");
      return next(createError(400, "You cannot mark your own messages as read"));
    }

    // 🔍 Cari semua pesan terkait conversationId
    console.log("🔍 Mencari pesan dalam conversationId:", message.conversationId);
    const unreadMessages = await Message.find({ 
      conversationId: message.conversationId, 
      read: false, 
      userId: { $ne: req.userId }
    });

    console.log("📜 Pesan yang belum dibaca:", unreadMessages.length);

    // 🔄 Update pesan sebagai "read"
    const result = await Message.updateMany(
      { conversationId: message.conversationId, read: false, userId: { $ne: req.userId } },
      { $set: { read: true } }
    );

    console.log("✅ Jumlah pesan yang diperbarui:", result.modifiedCount || 0);
    res.status(200).json({ success: true, message: "Messages marked as read" });
  } catch (err) {
    console.error("❌ Error dalam updateReadStatus:", err);
    next(err);
  }
};
