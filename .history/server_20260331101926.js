import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

import { TwitterAPI } from './utils/twitter.js';
import Campaign from "./models/Campaign.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, 'frontend/build')));

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
app.get("/api/auth/twitter", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const clientId = process.env.TWITTER_API_KEY;
  const redirectUri = process.env.TWITTER_APP_CALLBACK_URL;
  const scope = 'tweet.read%20tweet.write%20users.read%20follows.read%20follows.write%20like.read%20like.write';
  const state = `${req.userId}:${uuidv4()}`; // Include userId in state for callback

  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;

  res.json({ url: authUrl, state });
});

app.get("/api/auth/twitter/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`Twitter auth error: ${error}`);
  }

  if (!code || !state) {
    return res.status(400).send("Authorization code or state missing");
  }

  const [userId] = state.split(':');
  if (!userId) {
    return res.status(400).send("Invalid state parameter");
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.twitter.com/2/oauth2/token', {
      code,
      grant_type: 'authorization_code',
      client_id: process.env.TWITTER_API_KEY,
      redirect_uri: process.env.TWITTER_APP_CALLBACK_URL,
      code_verifier: 'challenge'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.TWITTER_API_KEY}:${process.env.TWITTER_API_KEY_SECRET}`).toString('base64')}`
      }
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const twitterUser = userResponse.data.data;

    // Update user with Twitter info
    await User.findByIdAndUpdate(userId, {
      twitterId: twitterUser.id,
      twitterUsername: twitterUser.username,
      twitterConnected: true,
      twitterAccessToken: access_token,
      twitterRefreshToken: refresh_token
    });

    res.send(`
      <h1>Twitter Connected!</h1>
      <p>Successfully connected @${twitterUser.username}</p>
      <p>You can close this window now.</p>
      <script>window.close();</script>
    `);

  } catch (err) {
    console.error('Twitter OAuth error:', err.response?.data || err.message);
    res.status(500).send('Failed to connect Twitter account');
  }
});

// Get user profile
app.get("/api/users/me", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// Task progress endpoint
app.post("/api/tasks/complete", isAuthenticated, async (req, res) => {
  const { campaignId } = req.body;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.twitterConnected || !user.twitterAccessToken) {
    return res.status(400).json({ error: "Twitter account not connected" });
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign || !campaign.isActive) {
    return res.status(404).json({ error: "Campaign not found or inactive" });
  }

  // Check if campaign is expired
  if (campaign.expiresAt && new Date() > new Date(campaign.expiresAt)) {
    return res.status(400).json({ error: "Campaign has expired" });
  }

  // Check if user already completed this campaign
  // For now, we'll allow multiple completions, but in production you might want to track this

  // Rate limiting
  if (user.lastTask && new Date() - new Date(user.lastTask) < 5000) {
    return res.status(429).json({ error: "Rate limit. Wait and try again." });
  }

  try {
    const twitter = new TwitterAPI(user.twitterAccessToken);
    let verified = false;

    switch (campaign.taskType) {
      case 'like':
        verified = await twitter.verifyLike(campaign.tweetId, user.twitterId);
        break;
      case 'retweet':
        verified = await twitter.verifyRetweet(campaign.tweetId, user.twitterId);
        break;
      case 'follow':
        verified = await twitter.verifyFollow(campaign.targetUserId, user.twitterId);
        break;
      case 'comment':
        verified = await twitter.verifyComment(campaign.tweetId, user.twitterId, campaign.expectedText);
        break;
    }

    if (!verified) {
      return res.status(400).json({ error: "Task not verified. Please complete the action on Twitter first." });
    }

    // Reward user
    user.points += campaign.rewardPoints;
    user.tasksCompleted += 1;
    user.lastTask = new Date();

    // Update level
    if (user.points >= 350) user.levels = "Diamond";
    else if (user.points >= 210) user.levels = "Gold";
    else if (user.points >= 140) user.levels = "Silver";
    else if (user.points >= 70) user.levels = "Bronze";

    await user.save();

    // Update campaign completion count
    campaign.completedCount += 1;
    await campaign.save();

    res.json({ success: true, user, campaign, verified: true });

  } catch (error) {
    console.error('Task verification error:', error);
    res.status(500).json({ error: "Failed to verify task" });
  }
});

// Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  const top = await User.find({}).sort({ points: -1 }).limit(20);
  res.json(top);
});

// Get active campaigns
app.get("/api/campaigns", async (req, res) => {
  try {
    const campaigns = await Campaign.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// Get campaign by ID
app.get("/api/campaigns/:id", async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
});

// Admin: Create campaign
app.post("/api/admin/campaigns", isAuthenticated, async (req, res) => {
  const { name, description, taskType, tweetId, targetUserId, expectedText, rewardPoints, maxUsers, expiresAt } = req.body;

  if (!name || !taskType) {
    return res.status(400).json({ error: "Name and taskType are required" });
  }

  try {
    const campaign = await Campaign.create({
      name,
      description,
      taskType,
      tweetId,
      targetUserId,
      expectedText,
      rewardPoints: rewardPoints || 10,
      maxUsers: maxUsers || 1000,
      expiresAt,
      createdBy: req.userId
    });

    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// Admin: Update campaign
app.put("/api/admin/campaigns/:id", isAuthenticated, async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

// Admin: Delete campaign
app.delete("/api/admin/campaigns/:id", isAuthenticated, async (req, res) => {
  try {
    await Campaign.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

// Admin: Get all campaigns
app.get("/api/admin/campaigns", isAuthenticated, async (req, res) => {
  try {
    const campaigns = await Campaign.find({}).sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// Get referral stats
app.get("/api/referrals/stats", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('referredUsers', 'username points createdAt');
    const referralCount = user.referredUsers.length;
    const totalBonus = user.referralBonus;

    res.json({
      referralCode: user.referralCode,
      referralCount,
      totalBonus,
      referredUsers: user.referredUsers
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get referral stats" });
  }
});

// Process referral
app.post("/api/referrals/join", async (req, res) => {
  const { referralCode, telegramId, username } = req.body;

  if (!referralCode || !telegramId) {
    return res.status(400).json({ error: "Referral code and telegramId required" });
  }

  try {
    // Find referrer
    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(400).json({ error: "Invalid referral code" });
    }

    // Find or create new user
    let newUser = await User.findOne({ telegramId });
    if (!newUser) {
      newUser = await User.create({
        telegramId,
        username,
        referredBy: referrer._id,
        referralCode: `${username}_${Date.now()}`
      });
    }

    // Add to referrer's referred users if not already there
    if (!referrer.referredUsers.includes(newUser._id)) {
      referrer.referredUsers.push(newUser._id);
      referrer.referralBonus += 5; // 5 bonus points per referral
      await referrer.save();
    }

    res.json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ error: "Failed to process referral" });
  }
});

// Catch all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API server running on http://localhost:${PORT}`));
