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

// Get messages
export const getMessages = async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;

    // Cek apakah conversationId valid
    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversationId" });
    }

    // Ambil pesan dari conversationId
    const messages = await Message.find({
  conversationId,
  $or: [
    { userId: req.userId, deletedBySender: { $ne: true } },
    { userId: { $ne: req.userId }, deletedByReceiver: { $ne: true } }
  ]
});


    // Jika tidak ada pesan, kirim array kosong agar tidak error
    if (!messages || messages.length === 0) {
      return res.status(200).json([]); // Kirim array kosong tanpa error
    }

    // Tandai pesan sebagai telah dibaca jika bukan milik user sendiri
    const updatedMessages = await Promise.all(
      messages.map(async (message) => {
        if (!message.read && String(message.userId) !== String(req.userId)) {
          return await Message.findByIdAndUpdate(
            message._id,
            { read: true },
            { new: true }
          );
        }
        return message;
      })
    );

    res.status(200).json(updatedMessages); // Kirim pesan yang telah diperbarui
  } catch (err) {
    next(err); // Tangani error
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
