// controllers/tripayWebhook.controller.js
import Withdrawal from "../models/withdrawal.model.js";

export const handleTripayCallback = async (req, res) => {
  try {
    const { merchant_ref, status, data } = req.body;

    const withdrawal = await Withdrawal.findOne({
      "payoutResponse.data.merchant_ref": merchant_ref,
    });

    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    await Withdrawal.findByIdAndUpdate(withdrawal._id, {
      status: status.toLowerCase(), // 'success' / 'failed' / 'pending'
      payoutResponse: data,
    });

    return res.status(200).json({ message: "Callback processed" });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ message: "Internal error on webhook" });
  }
};
