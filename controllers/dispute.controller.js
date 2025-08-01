import Dispute from "../models/dispute.model.js";
import Order from "../models/order.model.js";

export const createDispute = async (req, res) => {
  try {
    const dispute = await Dispute.create(req.body);

    // Tandai order memiliki sengketa
    await Order.findByIdAndUpdate(req.body.orderId, { hasDispute: true });

    res.status(201).json(dispute);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getDisputesByOrder = async (req, res) => {
  try {
    const disputes = await Dispute.find({ orderId: req.params.orderId });
    res.status(200).json(disputes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const dispute = await Dispute.findByIdAndUpdate(
      req.params.disputeId,
      { status: "resolved", resolution: req.body.resolution },
      { new: true }
    );
    res.status(200).json(dispute);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
