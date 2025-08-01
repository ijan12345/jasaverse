import express from "express";
import { verifyToken } from "../middleware/jwt.js";
import {
  createReview,
  getReviews,
  deleteReview,
  likeReview, // Tambahkan controller untuk like
  dislikeReview, // Tambahkan controller untuk dislike
  reportReview,
  getReportedReviews,
  normalizeReportedReview,
} from "../controllers/review.controller.js";

const router = express.Router();

router.post("/", verifyToken, createReview);
router.put("/:id/report", verifyToken, reportReview);
router.delete("/:id", deleteReview);
router.put("/:id/normalize", verifyToken, normalizeReportedReview);

// Endpoint baru untuk like dan dislike
router.get("/reported/all", verifyToken, getReportedReviews);
router.put("/:id/like", verifyToken, likeReview);
router.put("/:id/dislike", verifyToken, dislikeReview);
router.get("/:gigId", getReviews);

export default router;
