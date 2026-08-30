import dotenv from "dotenv";
dotenv.config();
import queueDashboard from "./routes/queue.dashboard.js";
import express from "express";
import cors from "cors";
import pool from "./config/database.js";
import emailRoutes from "./routes/email.routes.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);

app.use("/admin/queues", queueDashboard.getRouter());
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "ReachInbox backend is running",
  });
});

app.get("/health/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Database connection is working",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});