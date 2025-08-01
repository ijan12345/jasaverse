import express from "express";
import upload from "../middleware/upload.js";
import {
  createMessage,
  getMessages,
  updateReadStatus,
  deleteMessage,
  deleteMessageForEveryone,
  getAverageResponseTime ,
} from "../controllers/message.controller.js";
import { verifyToken } from "../middleware/jwt.js";


const router = express.Router();
router.delete("/:id", verifyToken, deleteMessage);
router.delete("/:id/all", verifyToken, deleteMessageForEveryone);
// Route untuk membuat pesan baru
router.post("/", verifyToken, createMessage);
router.get("/response-time/:userId", getAverageResponseTime);
// Route untuk mengambil pesan berdasarkan conversationId
router.get("/:id", verifyToken, getMessages);

// Route untuk memperbarui status pesan menjadi dibaca

router.put("/read", verifyToken, updateReadStatus);
router.put("/:id/read", verifyToken, updateReadStatus);


// Route untuk download file secara aman

export default router;
