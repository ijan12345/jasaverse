// api/routes/upload.routes.js
import express from "express";
import { deleteUpload } from "../controllers/upload.controller.js";
import { verifyToken } from "../middleware/jwt.js";

const router = express.Router();

// DELETE /api/uploads
router.delete("/", verifyToken, deleteUpload);

export default router;
