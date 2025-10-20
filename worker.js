// worker.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import chalk from "chalk";
import "./cron/refundEscrowJob.js";

// Load .env
dotenv.config();
mongoose.set("strictQuery", true);

// Connect ke MongoDB
const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log(chalk.white.bgBlue.bold("✅ Worker connected to MongoDB"));
  } catch (error) {
    console.error("❌ Worker failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

connect().then(() => {
  console.log("🚀 Cron worker berjalan & siap menjalankan refundEscrowJob.js...");
});
