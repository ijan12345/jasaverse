import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import createError from "../utils/createError.js";

export const register = async (req, res, next) => {
  try {
    const hash = bcrypt.hashSync(req.body.password, 5);

    // Tentukan role dan isSeller dengan logika eksplisit
    let role = "buyer";
    let isSeller = false;

    if (req.body.role === "seller" || req.body.isSeller === true) {
      role = "seller";
      isSeller = true;
    }

    const newUser = new User({
      ...req.body,
      password: hash,
      role,
      isSeller,
      emailVerified: false,
    });

    await newUser.save();
    res.status(201).send("Pengguna telah dibuat.");
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.body.username });

    if (!user) return next(createError(404, "Pengguna tidak ditemukan!"));

    const isCorrect = bcrypt.compareSync(req.body.password, user.password);
    if (!isCorrect)
      return next(createError(400, "Password salah atau username!"));

    const token = jwt.sign(
      {
        id: user._id,
        isSeller: user.isSeller,
        role: user.role,
      },
      process.env.JWT_KEY,
      { expiresIn: "7d" }
    );

    const { password, ...info } = user._doc;

    res
      .cookie("accessToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({ ...info, token }); // cukup kirim satu response

  } catch (err) {
    next(err);
  }
};


export const logout = async (req, res) => {
  res
    .clearCookie("accessToken", {
      sameSite: "none",
      secure: true,
    })
    .status(200)
    .send("Pengguna telah keluar.");
};


