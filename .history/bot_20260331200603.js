import { Telegraf } from "telegraf";
import User from "./models/User.js";
import axios from "axios";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error("[ERROR] TELEGRAM_BOT_TOKEN missing in .env");
  process.exit(1);
}

const bot = new Telegraf(botToken);

const BASE_URL = process.env.BASE_URL || 'https://buzzlayer.vercel.app';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'YourBotUsername';

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

bot.action(/campaign_(.+)/, async (ctx) => {
  const telegramId = String(ctx.from.id);
  const campaignId = ctx.match[1];
  const user = await User.findOne({ telegramId });

  if (!user) return ctx.answerCbQuery("User not found.");

  const Campaign = (await import("./models/Campaign.js")).default;
  const campaign = await Campaign.findById(campaignId);

  if (!campaign || !campaign.isActive) {
    return ctx.answerCbQuery("Campaign not found or inactive.");
  }

  // Check if Twitter is connected
  if (!user.twitterConnected) {
    return ctx.editMessageText(
      "❌ You need to connect your Twitter account first!\n\nUse the Mini App to connect Twitter.",
      actionKeyboard
    );
  }

  // Show campaign details and action button
  const campaignText = `🎯 **${campaign.name}**\n\n` +
    `${campaign.description}\n\n` +
    `📝 Task: ${campaign.taskType}\n` +
    `💰 Reward: ${campaign.rewardPoints} points\n\n` +
    `Complete this task on Twitter, then click "Verify" below.`;

  const verifyButton = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Verify Completion", callback_data: `verify_${campaignId}` }],
        [{ text: "⬅️ Back to Tasks", callback_data: "start_tasks" }]
      ]
    }
  };

  await ctx.editMessageText(campaignText, verifyButton);
});

bot.action(/verify_(.+)/, async (ctx) => {
  const telegramId = String(ctx.from.id);
  const campaignId = ctx.match[1];
  const user = await User.findOne({ telegramId });

  if (!user) return ctx.answerCbQuery("User not found.");

  const Campaign = (await import("./models/Campaign.js")).default;
  const campaign = await Campaign.findById(campaignId);

  if (!campaign) return ctx.answerCbQuery("Campaign not found.");

  // Call the API to verify task completion
  try {
    const response = await axios.post(`${BASE_URL}/api/tasks/complete`,
      { campaignId, telegramId }
    );

    const updatedUser = response.data.user;
    await ctx.answerCbQuery(`✅ Task verified! +${campaign.rewardPoints} points!`);
    await normalizeUserScoreReply(ctx, updatedUser);
  } catch (error) {
    const errorMsg = error.response?.data?.error || "Verification failed";
    await ctx.answerCbQuery(`❌ ${errorMsg}`);
  }
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

  const referralLink = `https://t.me/${BOT_USERNAME}?start=${user.referralCode}`;
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
    console.log("🤖 Telegraf bot launched successfully");
  } catch (err) {
    console.error("Bot launch failed:", err.message);
    console.log("Bot will not be available. Please configure a valid TELEGRAM_BOT_TOKEN");
    // Don't exit process, let server continue
  }
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
