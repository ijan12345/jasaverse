import express from "express";
import {
  createOffer,
  getMyOffers,
  getIncomingOffers,
  updateOfferStatus,
  getMyGigs,
  getOffersByRequestId,
  deleteOffer
} from "../controllers/offer.controller.js";
import { verifyToken } from "../middleware/jwt.js";

const router = express.Router();
// routes/gig.route.js
router.get("/my-gigs", verifyToken, getMyGigs);

// Seller buat penawaran
router.post("/", verifyToken, createOffer);
// Hapus penawaran
router.delete("/:offerId", verifyToken, deleteOffer);

// Seller lihat semua penawaran yang dia kirim
router.get("/my", verifyToken, getMyOffers);
router.get("/incoming/detail/:requestId", verifyToken, getOffersByRequestId);

// Buyer lihat semua penawaran masuk (pakai buyerId di URL biar match frontend)
router.get("/incoming/:buyerId", verifyToken, getIncomingOffers);

// Buyer terima / tolak penawaran
router.patch("/:offerId/status", verifyToken, updateOfferStatus);

export default router;
