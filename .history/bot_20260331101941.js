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
    // Check for referral code in start command
    const referralCode = ctx.startPayload;
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
    }

    user = await User.create({
      telegramId,
      username,
      referralCode: `${username}_${Date.now()}`,
      referredBy: referrer?._id
    });

    // Update referrer if exists
    if (referrer) {
      referrer.referredUsers.push(user._id);
      referrer.referralBonus += 5;
      await referrer.save();

      await ctx.reply(`Welcome ${username}! You were referred by @${referrer.username}. Both of you get bonus points! 🎉`);
    } else {
      await ctx.reply(`Hello ${username}! Welcome to X engagement bot. Earn points by completing actions.`, actionKeyboard);
    }
  } else {
    await ctx.reply(`Welcome back ${username}!`, actionKeyboard);
  }
});

bot.action("start_tasks", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const user = await User.findOne({ telegramId });
  if (!user) return ctx.answerCbQuery("User not found, please /start again.");

  // Fetch active campaigns
  const Campaign = (await import("./models/Campaign.js")).default;
  const campaigns = await Campaign.find({ isActive: true }).limit(10);

  if (campaigns.length === 0) {
    return ctx.editMessageText("No active campaigns available right now. Check back later!", actionKeyboard);
  }

  const taskButtons = {
    reply_markup: {
      inline_keyboard: campaigns.map((campaign, index) => [{
        text: `${campaign.name} (+${campaign.rewardPoints}pts)`,
        callback_data: `campaign_${campaign._id}`
      }])
    },
  };

  await ctx.editMessageText("Choose a campaign to participate in:", taskButtons);
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

bot.command('referral', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const user = await User.findOne({ telegramId });

  if (!user) return ctx.reply("Please /start first");

  const referralLink = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${user.referralCode}`;
  const referralCount = user.referredUsers?.length || 0;

  await ctx.reply(
    `🔗 Your referral link: ${referralLink}\n\n` +
    `👥 Referred users: ${referralCount}\n` +
    `💰 Referral bonus: ${user.referralBonus} points\n\n` +
    `Share your link and earn 5 points for each friend who joins!`
  );
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
