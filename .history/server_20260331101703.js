import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

import User from "./models/User.js";
import { isAuthenticated } from "./middleware/auth.js";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/telegram_x_growth";
const JWT_SECRET = process.env.JWT_SECRET || "super_secret";

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));
mongoose.connection.on("error", (err) => console.error("MongoDB error", err));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Telegram auto login (placeholder: public key for mini app)
app.post("/api/auth/telegram", async (req, res) => {
  const { telegramId, username } = req.body;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });

  let user = await User.findOne({ telegramId });
  if (!user) {
    user = await User.create({
      telegramId,
      username,
      walletAddress: "",
      levels: "Bronze",
      referralCode: uuidv4(),
      tasksCompleted: 0,
      points: 0,
      streak: 0,
      twitterConnected: false,
      createdAt: new Date(),
    });
  }

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user });
});

// Twitter OAuth link generation (redirect to X / Twitter login)
app.get("/api/auth/twitter", (req, res) => {
  const clientId = process.env.TWITTER_API_KEY;
  const redirectUri = process.env.TWITTER_APP_CALLBACK_URL;
  const scope = 'tweet.read%20tweet.write%20users.read%20follows.read%20follows.write%20like.read%20like.write';
  const state = uuidv4(); // Store in session/cache for CSRF protection

  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;

  res.json({ url: authUrl, state });
});

app.get("/api/auth/twitter/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "code query required" });

  // TODO: Exchange code for access token using X OAuth2 endpoint.
  res.send("Twitter callback received; implement token exchange in backend.");
});

// Get user profile
app.get("/api/users/me", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// Task progress endpoint
app.post("/api/tasks/complete", isAuthenticated, async (req, res) => {
  const { taskType, tweetId } = req.body;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!taskType || !["like", "retweet", "follow", "comment"].includes(taskType)) {
    return res.status(400).json({ error: "Invalid task type" });
  }

  // Emit anti-cheat logic: simple hack prevention
  if (user.lastTask && new Date() - new Date(user.lastTask) < 5000) {
    return res.status(429).json({ error: "Rate limit. Wait and try again." });
  }

  user.points += 10;
  user.tasksCompleted += 1;
  user.lastTask = new Date();

  if (user.points >= 350) user.levels = "Diamond";
  else if (user.points >= 210) user.levels = "Gold";
  else if (user.points >= 140) user.levels = "Silver";
  else if (user.points >= 70) user.levels = "Bronze";

  await user.save();

  res.json({ success: true, user });
});

// Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  const top = await User.find({}).sort({ points: -1 }).limit(20);
  res.json(top);
});

// Admin campaign placeholder
app.post("/api/admin/campaign", isAuthenticated, async (req, res) => {
  const { name, taskType, reward } = req.body;
  if (!name || !taskType || !reward) {
    return res.status(400).json({ error: "Missing fields" });
  }
  // TODO: store campaigns in separate collection
  res.json({ success: true, campaign: { name, taskType, reward } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API server running on http://localhost:${PORT}`));
