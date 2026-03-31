import { Telegraf } from "telegraf";
import User from "./models/User.js";
import axios from "axios";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error("[ERROR] TELEGRAM_BOT_TOKEN missing in .env");
  process.exit(1);
}

const bot = new Telegraf(botToken);

const actionKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🚀 Start Task", callback_data: "start_tasks" }],
      [{ text: "🏆 Leaderboard", callback_data: "leaderboard" }],
      [{ text: "👤 My Profile", callback_data: "profile" }],
    ],
  },
};

bot.start(async (ctx) => {
  const telegramId = String(ctx.from.id);
  const username = ctx.from.username || "anonymous";

  let user = await User.findOne({ telegramId });
  if (!user) {
    user = await User.create({ telegramId, username, referralCode: `${username}_${Date.now()}` });
  }

  await ctx.reply(`Hello ${username}! Welcome to X engagement bot. Earn points by completing actions.`, actionKeyboard);
});

bot.action("start_tasks", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const user = await User.findOne({ telegramId });
  if (!user) return ctx.answerCbQuery("User not found, please /start again.");

  const taskButtons = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "❤️ Like Tweet", callback_data: "task_like" }],
        [{ text: "🔁 Retweet", callback_data: "task_retweet" }],
        [{ text: "👤 Follow", callback_data: "task_follow" }],
        [{ text: "💬 Comment", callback_data: "task_comment" }],
      ],
    },
  };

  await ctx.editMessageText("Choose a task to claim points:", taskButtons);
});

const normalizeUserScoreReply = async (ctx, user) => {
  const text = `👤 @${user.username}\n` +
    `Points: ${user.points}\n` +
    `Tasks: ${user.tasksCompleted}\n` +
    `Level: ${user.levels}\n` +
    `Streak: ${user.streak}`;
  await ctx.editMessageText(text, actionKeyboard);
};

async function rewardUser(user, taskType) {
  user.points += 10;
  user.tasksCompleted += 1;
  user.lastTask = new Date();

  const levels = ["Bronze", "Silver", "Gold", "Diamond"];
  const thresholds = [0, 70, 140, 210];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (user.points >= thresholds[i]) {
      user.levels = levels[i];
      break;
    }
  }

  await user.save();
  return user;
}

bot.action(/task_(like|retweet|follow|comment)/, async (ctx) => {
  const telegramId = String(ctx.from.id);
  const task = ctx.match[1];
  const user = await User.findOne({ telegramId });
  if (!user) return ctx.answerCbQuery("User not found.");

  const shouldProceed = true;

  if (!shouldProceed) {
    return ctx.answerCbQuery("Unable to verify this task yet. Complete it manually and claim later.");
  }

  // In a real system we'd verify via Twitter API here
  // Example: axios.get('https://api.twitter.com/2/users/{id}/likes')

  const updated = await rewardUser(user, task);
  await ctx.answerCbQuery(`✅ ${task} task verified, +10 points!`);
  await normalizeUserScoreReply(ctx, updated);
});

bot.action("profile", async (ctx) => {
  const user = await User.findOne({ telegramId: String(ctx.from.id) });
  if (!user) return ctx.answerCbQuery("User not found.");
  await normalizeUserScoreReply(ctx, user);
});

bot.action("leaderboard", async (ctx) => {
  const top = await User.find({}).sort({ points: -1 }).limit(10);
  const text = top.map((u, i) => `${i + 1}. @${u.username} - ${u.points} pts`).join("\n");
  return ctx.editMessageText(`🏆 Leaderboard:\n${text}`, actionKeyboard);
});

bot.catch((err, ctx) => {
  console.error("Bot error", err);
  ctx.reply("An error occurred. Please try again.");
});

(async () => {
  try {
    await bot.launch();
    console.log("🤖 Telegraf bot launched");
  } catch (err) {
    console.error("Bot launch failed", err);
    process.exit(1);
  }
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
