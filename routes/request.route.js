// routes/request.route.js
import express from "express";
import {
  createRequest,
  deleteRequest,
  getRequests,
  getRequestById,
  getAllRequests
} from "../controllers/request.controller.js"; // ✅ diarahkan ke controller yang benar
import { verifyToken } from "../middleware/jwt.js";

const router = express.Router();

router.post("/", verifyToken, createRequest);
router.delete("/:id", verifyToken, deleteRequest);
router.get("/all", verifyToken, getAllRequests);
router.get("/single/:id", verifyToken, getRequestById); // ✅ ambil detail by ID
router.get("/", verifyToken, getRequests);

export default router;
