import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  taskType: { type: String, required: true, enum: ['like', 'retweet', 'follow', 'comment'] },
  tweetId: { type: String }, // For like/retweet/comment tasks
  targetUserId: { type: String }, // For follow tasks
  expectedText: { type: String }, // For comment tasks
  rewardPoints: { type: Number, default: 10 },
  maxUsers: { type: Number, default: 1000 },
  completedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

campaignSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Campaign", campaignSchema);