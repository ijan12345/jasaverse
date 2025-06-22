import express from "express";
import { getSellerScores } from "../controllers/seller.controller.js";

const router = express.Router();

router.get("/scores", getSellerScores);

export default router;
