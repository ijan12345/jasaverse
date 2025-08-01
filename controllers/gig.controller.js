import Gig from "../models/gig.model.js";
import Order from "../models/order.model.js";
import Review from "../models/review.model.js";
import createError from "../utils/createError.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js"
import cloudinary from "../utils/cloudinary.js";

// Fungsi untuk membuat Gig
export const createGig = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) return next(createError(401, "You must be logged in"));

    const decoded = jwt.verify(token, process.env.JWT_KEY);
    req.userId = decoded.id;

    if (!decoded.isSeller) return next(createError(403, "Only sellers can create a gig!"));

    const {
      cover,
      coverPublicId,        // ✅ Terima dari frontend saat upload
      images,
      imagePublicIds,       // ✅ Terima dari frontend saat upload multiple
    } = req.body;

    const newGig = new Gig({
      ...req.body,
      userId: new mongoose.Types.ObjectId(req.userId),
      cover,
      coverPublicId,
      images,
      imagePublicIds,
    });

    const savedGig = await newGig.save();
    res.status(201).json(savedGig);
  } catch (err) {
    next(err);
  }
};


// Fungsi untuk menghapus Gig
export const deleteGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return next(createError(404, "Gig not found!"));

    const user = await User.findById(req.userId);
    if (!user) return next(createError(404, "User not found!"));

    if (gig.userId.toString() !== req.userId.toString() && user.role !== "admin") {
      return next(createError(403, "You can only delete your own gig unless you are an admin!"));
    }

    // ✅ Hapus gambar dari Cloudinary
    if (gig.coverPublicId) {
      await cloudinary.uploader.destroy(gig.coverPublicId);
    }

    if (gig.imagePublicIds && Array.isArray(gig.imagePublicIds)) {
      for (const publicId of gig.imagePublicIds) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    await Gig.findByIdAndDelete(req.params.id);
    res.status(200).send("Gig has been deleted!");
  } catch (err) {
    next(err);
  }
};
export const getGig = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(createError(400, "Invalid Gig ID"));
    }

    const gig = await Gig.findById(req.params.id).populate("userId", "username");

    if (!gig) return next(createError(404, "Gig not found!"));

    // Pastikan userId dikirim sebagai string ke frontend
    const gigWithUserIdAsString = {
      ...gig.toObject(),
      userId: gig.userId?._id.toString(), // Konversi userId ke string
    };

    res.status(200).json(gigWithUserIdAsString);
  } catch (err) {
    console.error("Error in getGig:", err.message);
    next(err);
  }
};

// Fungsi untuk mendapatkan Gig berdasarkan ID
export const getGigs = async (req, res, next) => {
  const q = req.query;

  const filters = {
    ...(q.userId && { userId: new mongoose.Types.ObjectId(q.userId) }),
    ...((q.min || q.max) && {
      price: {
        ...(q.min && { $gt: q.min }),
        ...(q.max && { $lt: q.max }),
      },
    }),
  };

  if (q.search) {
    const keyword = q.search.toLowerCase();

    // 🔥 Sorting berdasarkan kata kunci khusus
const sortMapping = {
  terpopuler: "sales",
  populer: "sales",
  populeritas: "sales",
  terbaru: "createdAt",
  tren: "sales",
  trending: "sales",
  mahal: "price",
  termurah: "price",
  murah: "price",
  semua: "createdAt",
};
if (["semua", "semua gig", "tampilkan semua", "lihat semua", "all", "semua jasa", "all project"].some(k => keyword.includes(k))) {
  // Abaikan pencarian, tampilkan semua gig
  delete filters.$or;
  delete filters.price;
  delete filters.userId;
  q.search = ""; // kosongkan agar tidak ikut dalam filter regex
}
if (filters.$or && filters.$or.length === 0) {
  delete filters.$or;
}

const matchedSort = Object.keys(sortMapping).find((key) =>
  keyword.includes(key)
);

if (matchedSort) {
  q.sort = sortMapping[matchedSort];

  // Harga murah: urutan ASC (naik), sisanya DESC (turun)
  if (matchedSort === "murah" || matchedSort === "termurah") {
    q.sortOrder = "asc";
  } else {
    q.sortOrder = "desc";
  }
}


// 🔍 Mapping keyword ke kategori secara manual (100+ baris)
const keywordToCategory = {
  // Design & Creative
  logo: "Design & Creative / Desain & Kreatif",
  desain: "Design & Creative / Desain & Kreatif",
  design: "Design & Creative / Desain & Kreatif",
  gambar: "Design & Creative / Desain & Kreatif",
  banner: "Design & Creative / Desain & Kreatif",
  poster: "Design & Creative / Desain & Kreatif",
  brosur: "Design & Creative / Desain & Kreatif",
  flyer: "Design & Creative / Desain & Kreatif",
  mockup: "Design & Creative / Desain & Kreatif",
  kemasan: "Design & Creative / Desain & Kreatif",
  packaging: "Design & Creative / Desain & Kreatif",
  ui: "Design & Creative / Desain & Kreatif",
  ux: "Design & Creative / Desain & Kreatif",
  interface: "Design & Creative / Desain & Kreatif",
  grafis: "Design & Creative / Desain & Kreatif",
  graphic: "Design & Creative / Desain & Kreatif",
  illustrator: "Design & Creative / Desain & Kreatif",
  canva: "Design & Creative / Desain & Kreatif",
  figma: "Design & Creative / Desain & Kreatif",
  adobe: "Design & Creative / Desain & Kreatif",
  branding: "Design & Creative / Desain & Kreatif",

  // Academic & Education
  kampus: "Academic & Education / Akademik & Edukasi",
  akademik: "Academic & Education / Akademik & Edukasi",
  pendidikan: "Academic & Education / Akademik & Edukasi",
  tugas: "Academic & Education / Akademik & Edukasi",
  makalah: "Academic & Education / Akademik & Edukasi",
  jurnal: "Academic & Education / Akademik & Edukasi",
  skripsi: "Academic & Education / Akademik & Edukasi",
  tesis: "Academic & Education / Akademik & Edukasi",
  disertasi: "Academic & Education / Akademik & Edukasi",
  ppt: "Academic & Education / Akademik & Edukasi",
  presentasi: "Academic & Education / Akademik & Edukasi",
  belajar: "Academic & Education / Akademik & Edukasi",
  tutor: "Academic & Education / Akademik & Edukasi",
  bimbingan: "Academic & Education / Akademik & Edukasi",
  akademisi: "Academic & Education / Akademik & Edukasi",

  // Typing & Administration
  pengetikan: "Typing & Administration / Pengetikan & Administrasi",
  administrasi: "Typing & Administration / Pengetikan & Administrasi",
  ketik: "Typing & Administration / Pengetikan & Administrasi",
  format: "Typing & Administration / Pengetikan & Administrasi",
  word: "Typing & Administration / Pengetikan & Administrasi",
  excel: "Typing & Administration / Pengetikan & Administrasi",
  dokumen: "Typing & Administration / Pengetikan & Administrasi",
  salin: "Typing & Administration / Pengetikan & Administrasi",
  mengetik: "Typing & Administration / Pengetikan & Administrasi",
  spreadsheet: "Typing & Administration / Pengetikan & Administrasi",
  resume: "Typing & Administration / Pengetikan & Administrasi",
  dataentry: "Typing & Administration / Pengetikan & Administrasi",
  pengarsipan: "Typing & Administration / Pengetikan & Administrasi",
  laporan: "Typing & Administration / Pengetikan & Administrasi",

  // Technology & Programming
  teknologi: "Technology & Programming / Teknologi & Pemrograman",
  coding: "Technology & Programming / Teknologi & Pemrograman",
  program: "Technology & Programming / Teknologi & Pemrograman",
  pemrograman: "Technology & Programming / Teknologi & Pemrograman",
  aplikasi: "Technology & Programming / Teknologi & Pemrograman",
  software: "Technology & Programming / Teknologi & Pemrograman",
  website: "Technology & Programming / Teknologi & Pemrograman",
  web: "Technology & Programming / Teknologi & Pemrograman",
  app: "Technology & Programming / Teknologi & Pemrograman",
  mobile: "Technology & Programming / Teknologi & Pemrograman",
  android: "Technology & Programming / Teknologi & Pemrograman",
  ios: "Technology & Programming / Teknologi & Pemrograman",
  backend: "Technology & Programming / Teknologi & Pemrograman",
  frontend: "Technology & Programming / Teknologi & Pemrograman",
  fullstack: "Technology & Programming / Teknologi & Pemrograman",
  dev: "Technology & Programming / Teknologi & Pemrograman",
  developer: "Technology & Programming / Teknologi & Pemrograman",
  database: "Technology & Programming / Teknologi & Pemrograman",
  python: "Technology & Programming / Teknologi & Pemrograman",
  javascript: "Technology & Programming / Teknologi & Pemrograman",
  react: "Technology & Programming / Teknologi & Pemrograman",
  html: "Technology & Programming / Teknologi & Pemrograman",
  css: "Technology & Programming / Teknologi & Pemrograman",
  node: "Technology & Programming / Teknologi & Pemrograman",
  flutter: "Technology & Programming / Teknologi & Pemrograman",

  // Art & Music
  musik: "Art & Music / Seni & Musik",
  seni: "Art & Music / Seni & Musik",
  lagu: "Art & Music / Seni & Musik",
  audio: "Art & Music / Seni & Musik",
  suara: "Art & Music / Seni & Musik",
  vokal: "Art & Music / Seni & Musik",
  mixing: "Art & Music / Seni & Musik",
  mastering: "Art & Music / Seni & Musik",
  band: "Art & Music / Seni & Musik",
  cover: "Art & Music / Seni & Musik",
  lirik: "Art & Music / Seni & Musik",
  produksi: "Art & Music / Seni & Musik",
  piano: "Art & Music / Seni & Musik",
  gitar: "Art & Music / Seni & Musik",
  instrumental: "Art & Music / Seni & Musik",

  // Others & General
  umum: "Others & General / Lainnya & Umum",
  lain: "Others & General / Lainnya & Umum",
  lainnya: "Others & General / Lainnya & Umum",
  random: "Others & General / Lainnya & Umum",
  campuran: "Others & General / Lainnya & Umum",
  kebutuhan: "Others & General / Lainnya & Umum",
  permintaan: "Others & General / Lainnya & Umum",
  jasa: "Others & General / Lainnya & Umum",
  bantuan: "Others & General / Lainnya & Umum",
  freelance: "Others & General / Lainnya & Umum",
  order: "Others & General / Lainnya & Umum",
  custom: "Others & General / Lainnya & Umum",
  tugasumum: "Others & General / Lainnya & Umum",
};


    const matchedCategories = Object.keys(keywordToCategory)
      .filter((key) => keyword.includes(key))
      .map((key) => keywordToCategory[key]);

    const isNumber = /^\d+$/.test(q.search);
    const parsedNumber = parseInt(q.search, 10);

    // 🔎 Buat array kondisi OR untuk pencarian fleksibel
    filters.$or = [
      { title: { $regex: q.search, $options: "i" } },
      { desc: { $regex: q.search, $options: "i" } },
      { category: { $regex: q.search, $options: "i" } },
      ...(isNumber ? [{ price: parsedNumber }] : []),
      ...(matchedCategories.map((cat) => ({ category: cat }))),
    ];
  }

  try {
    const gigs = await Gig.find(filters)
      .populate("userId", "username")
      .sort({ [q.sort]: q.sortOrder === "asc" ? 1 : -1 });


    const updatedGigs = gigs.map((gig) => gig.toObject());

    res.status(200).json(updatedGigs);
  } catch (err) {
    console.error("Error in getGigs:", err.message);
    next(err);
  }
};

// Fungsi untuk memperbarui Gig
export const updateGig = async (req, res, next) => {
  console.log("📩 Received PUT /gigs/:id with body:", req.body);

  const gigId = req.params.id;

  try {
    if (req.body.price && req.body.price < 0) {
      return res.status(400).json({ message: "Harga harus berupa angka positif" });
    }

    const updatedGig = await Gig.findByIdAndUpdate(
      gigId,
      { $set: req.body },
      { new: true }
    );

    if (!updatedGig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    res.status(200).json(updatedGig);
  } catch (error) {
    console.error("Error updating gig:", error);
    res.status(500).json({ message: "Failed to update gig", error: error.message });
  }
};


// Fungsi untuk membuat review
export const createReview = async (req, res, next) => {
  const { gigId, description, star } = req.body;
  const currentUserId = req.userId;

  try {
    const gig = await Gig.findById(gigId);
    if (!gig) return next(createError(404, "Gig not found!"));

    const isPurchased = gig.purchasedBy.includes(currentUserId);
    const isOwner = gig.userId.toString() === currentUserId.toString();

    if (!isPurchased && !isOwner) {
      return next(createError(403, "You must purchase the gig or be the owner to review"));
    }

    const review = new Review({
      gigId,
      userId: currentUserId,
      description,
      star,
    });

    await review.save();
    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
};

export const getUserAverageRating = async (req, res) => {
  const { userId } = req.params;

  try {
    // Ambil semua gig milik seller
    const gigs = await Gig.find({ userId });

    if (!gigs || gigs.length === 0) {
      return res.json({ averageRating: null, totalReviews: 0 });
    }

    let totalStars = 0;
    let totalReviews = 0;

    for (const gig of gigs) {
      totalStars += gig.totalStars || 0;
      totalReviews += gig.starNumber || 0;
    }

    if (totalReviews === 0) {
      return res.json({ averageRating: null, totalReviews: 0 });
    }

    const average = totalStars / totalReviews;
    res.json({
      averageRating: parseFloat(average.toFixed(2)),
      totalReviews,
    });
  } catch (err) {
    console.error("❌ Error getUserAverageRating:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Mendapatkan total penjualan berdasarkan userId
export const getTotalSales = async (req, res) => {
  const userId = req.params.userId;

  try {
    const gigs = await Gig.find({ userId });
    const totalSales = gigs.reduce((sum, gig) => sum + (gig.sales || 0), 0);
    
    res.json({ totalSales });
  } catch (err) {
    console.error("Error fetching total sales:", err);
    res.status(500).json({ message: "Error fetching total sales" });
  }
};


// Fungsi untuk mendapatkan jumlah Gig yang dimiliki berdasarkan userId
export const getOwnedGigs = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const ownedGigs = await Gig.find({ userId });

    if (!ownedGigs || ownedGigs.length === 0) {
      return res.json({ ownedGigsCount: 0 });
    }

    res.json({ ownedGigsCount: ownedGigs.length });
  } catch (err) {
    console.error("Error fetching owned gigs:", err);
    next(err);
  }
};
