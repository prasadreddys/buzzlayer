import dotenv from "dotenv";
dotenv.config();

import "./server.js";

// Only start bot if token is available
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
  import("./bot.js").catch(err => {
    console.error("Bot startup failed:", err.message);
    console.log("Server will continue running without bot functionality");
  });
} else {
  console.log("⚠️  Telegram bot token not configured. Server running without bot.");
}

console.log("🔧 Telegram-X Growth Engine starting...");
