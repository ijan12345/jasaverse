import jwt from "jsonwebtoken";
import createError from "../utils/createError.js";

export const authenticateUser = (req, res, next) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) return next(createError(401, "You must be logged in"));

    const decoded = jwt.verify(token, process.env.JWT_KEY);
    req.userId = decoded.id;
    req.isSeller = decoded.isSeller;

    next();
  } catch (error) {
    next(createError(403, "Invalid token"));
  }
};
