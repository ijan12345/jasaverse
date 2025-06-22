import multer from "multer";
import fs from "fs";
import path from "path";

// Folder penyimpanan
const uploadFolder = "uploads";
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

// Konfigurasi penyimpanan multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const originalExt = path.extname(file.originalname); // .pdf, .docx, dll
    const safeName = path.basename(file.originalname, originalExt)
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]/g, "");
    cb(null, Date.now() + "-" + safeName + originalExt);
  },
});

// Multer upload
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export default upload;
