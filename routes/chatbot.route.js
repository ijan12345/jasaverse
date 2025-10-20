// routes/chatbot.route.js
import express from "express";
import { askChatbot } from "../controllers/chatbot.controller.js";

const router = express.Router();

router.post("/chat", askChatbot);

export default router;
