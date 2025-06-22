// routes/tripayWebhook.route.js
import express from "express";
import { handleTripayCallback } from "../controllers/tripayWebhook.controller.js";

const router = express.Router();

router.post("/callback", handleTripayCallback);

export default router;
