import chalk from "chalk";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRoute from "./routes/user.route.js";
import gigRoute from "./routes/gig.route.js";
import { handleXenditWebhook } from "./controllers/withdrawal.controller.js";
import orderRoute from "./routes/order.route.js";
import conversationRoute from "./routes/conversation.route.js";
import messageRoute from "./routes/message.route.js";
import withdrawalRoute from "./routes/withdrawal.route.js"; // <--- Tambahkan ini
import reviewRoute from "./routes/review.route.js";
import authRoute from "./routes/auth.route.js";
import cookieParser from "cookie-parser";
import cors from "cors";
//import Stripe from "stripe";
import midtransRoute from "./routes/midtrans.route.js";
import adminRoute from "./routes/admin.route.js";
import path from "path";
import uploadRoutes from "./routes/upload.routes.js";

import { fileURLToPath } from "url";
import sellerRoutes from "./routes/seller.route.js";
import { createServer } from "http";         // <-- import http server
import { Server } from "socket.io";          // <-- import socket.io






// Get the current directory of the module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// Load environment variables
dotenv.config();
mongoose.set("strictQuery", true);

// MongoDB connection function
const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO);
     console.log(chalk.white.bgBlue.bold("✅ Connected to MongoDB!"));
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit the process if DB connection fails
  }
};


//export const stripe = new  Stripe(process.env.STRIPE);

// Middlewares 
app.use(cors({ 
  origin: [ "http://192.168.18.126:19000", // Your frontend address
    "https://7d5a-202-46-68-35.ngrok-free.app",
  "http://localhost:5173"       // untuk Expo React Native
  ],
  credentials: true,               // Allow credentials like cookies
}));
app.use(express.json());            // Parse JSON request bodies
app.use(cookieParser());            // Parse cookies



// Routes
app.use("/api/webhook/xendit", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.post("/api/webhook/xendit", handleXenditWebhook);
app.use("/api/midtrans", midtransRoute);
app.use("/api/admin", adminRoute);
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/uploads", uploadRoutes);
app.use("/api/withdrawals", withdrawalRoute); // <--- Route endpoint untuk penarikan dana
app.use("/api/sellers", sellerRoutes);
app.use("/api/gigs", gigRoute);
app.use("/api/orders", orderRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/messages", messageRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/uploads/", express.static(path.join(__dirname, "uploads")));



// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error stack for debugging
  const errorStatus = err.status || 500;
  const errorMessage = err.message || "Something went wrong!";
  res.status(errorStatus).json({
    success: false,
    status: errorStatus,
    message: errorMessage,
    stack: process.env.NODE_ENV === "development" ? err.stack : {}, // Show stack in development only
  });
});

// Create HTTP server from Express app
const httpServer = createServer(app);

// Initialize Socket.IO server
const allowedOrigins = [
  "https://7d5a-202-46-68-35.ngrok-free.app"
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Socket.IO event handling
io.on("connection", (socket) => {
  console.log("User connected, socket ID:", socket.id);

  // Example: listen event 'sendMessage' from client
  socket.on("sendMessage", (data) => {
    console.log("Message received:", data);
    // Broadcast message to all connected clients except sender
    socket.broadcast.emit("receiveMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected, socket ID:", socket.id);
  });
});

// Start the server
connect().then(() => {
  const PORT = process.env.PORT || 8800;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(chalk.white.bgBlue.bold(`✅ Backend server is running on port ${PORT}`));
  });
});


