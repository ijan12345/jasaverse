import express from "express";
import { createDispute, getDisputesByOrder, resolveDispute } from "../controllers/dispute.controller.js";

const router = express.Router();

router.post("/", createDispute);
router.get("/order/:orderId", getDisputesByOrder);
router.put("/:disputeId/resolve", resolveDispute);

export default router;
