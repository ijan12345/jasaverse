import express from "express";
import {
  createConversation,
  getConversation,
  getSingleConversation,
  updateConversation,
  deleteConversation,
  deleteAllConversations,
} from "../controllers/conversation.controller.js";
import { verifyToken } from "../middleware/jwt.js";

const router = express.Router();

// Get all conversations for a user (either as a seller or a buyer)
router.get("/", verifyToken, getConversation);

router.delete("/all", verifyToken, deleteAllConversations);

// Create a new conversation
router.post("/", verifyToken, createConversation);

// Get a single conversation by sellerId & buyerId
router.get("/single", verifyToken, getSingleConversation);

// Update conversation (mark as read by the seller or buyer)
router.put("/:id", verifyToken, updateConversation);

// Delete a conversation by ID
router.delete("/:id", verifyToken, deleteConversation);

export default router;
