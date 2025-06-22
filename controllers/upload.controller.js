// api/controllers/upload.controller.js
import cloudinary from "../utils/cloudinary.js";

export const deleteUpload = async (req, res, next) => {
  try {
    const { public_id, resource_type } = req.body;
    if (!public_id) return res.status(400).json({ error: "Missing public_id" });

    const result = await cloudinary.uploader.destroy(public_id, {
      resource_type: resource_type || "image",
    });

    res.json({ result });
  } catch (err) {
    next(err);
  }
};
