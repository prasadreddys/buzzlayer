import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String },
  twitterId: { type: String },
  twitterUsername: { type: String },
  twitterConnected: { type: Boolean, default: false },
  twitterAccessToken: { type: String },
  twitterRefreshToken: { type: String },
  walletAddress: { type: String, default: "" },
  referralCode: { type: String, unique: true },
  referredUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  referralBonus: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastActiveDate: { type: Date },
  levels: { type: String, default: "Bronze" },
  lastTask: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("User", userSchema);
