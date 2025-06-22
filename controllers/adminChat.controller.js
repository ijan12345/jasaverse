import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";

// ===============================
// 1️⃣ Kirim Pesan (Admin/User)
// ===============================
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, desc, file } = req.body;
    const senderId = req.userId; // ID pengirim dari token JWT
    const adminReply = req.isAdmin; // Jika admin yang mengirim pesan, ini akan true

    // Pastikan penerima valid
    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ message: "Penerima tidak ditemukan" });

    // Cari atau buat conversation baru
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
      });
      await conversation.save();
    }

    // Simpan pesan baru
    const newMessage = new Message({
      conversationId: conversation._id,
      senderId,
      receiverId,
      senderName: req.userName, // Nama pengirim
      desc,
      file,
      adminReply,
    });

    await newMessage.save();

    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ message: "Terjadi kesalahan, coba lagi nanti" });
  }
};

// ===============================
// 2️⃣ Ambil Semua Pesan dalam Percakapan
// ===============================
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: "Terjadi kesalahan, coba lagi nanti" });
  }
};

// ===============================
// 3️⃣ Tandai Pesan sebagai "Read"
// ===============================
export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Pesan tidak ditemukan" });

    message.status = "read";
    message.read = true;

    await message.save();

    res.status(200).json({ message: "Pesan ditandai sebagai dibaca" });
  } catch (err) {
    res.status(500).json({ message: "Terjadi kesalahan, coba lagi nanti" });
  }
};
