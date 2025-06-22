import express from "express";
import { verifyToken } from "../middleware/jwt.js";
import {
  createReview,
  getReviews,
  deleteReview,
  likeReview, // Tambahkan controller untuk like
  dislikeReview, // Tambahkan controller untuk dislike
} from "../controllers/review.controller.js";

const router = express.Router();

router.post("/", verifyToken, createReview);
router.get("/:gigId", getReviews);
router.delete("/:id", deleteReview);

// Endpoint baru untuk like dan dislike
router.put("/:id/like", verifyToken, likeReview);
router.put("/:id/dislike", verifyToken, dislikeReview);

export default router;
