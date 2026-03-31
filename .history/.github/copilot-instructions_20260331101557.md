# Workspace Instructions for TelegramBot

## Project Overview
This is a Telegram Mini App Bot for Twitter (X) engagement gamification. It combines a Telegram bot interface with a web app for user engagement tracking and rewards.

## Tech Stack
- Node.js with ES modules
- Express.js for REST API
- Telegraf for Telegram bot
- MongoDB with Mongoose
- JWT for authentication
- Axios for HTTP requests

## Build and Run Commands
- `npm start`: Run in production mode
- `npm run dev`: Run with auto-reload using nodemon
- `npm run lint`: Lint code with ESLint

## Architecture Decisions
- Dual entry point: index.js runs both Express server and Telegraf bot
- User model with leveling system (Bronze/Silver/Gold/Diamond based on points)
- Tasks system for social media engagement (like, retweet, follow, comment)
- JWT-based API authentication

## Project Conventions
- Use async/await for asynchronous operations
- Middleware for authentication
- Callback-based Telegram UI interactions
- Points system: each task completion gives 10 points

## Potential Pitfalls
- JWT_SECRET is hardcoded as "super_secret" - change in production
- Twitter integration is incomplete: OAuth callback and task verification not implemented
- No anti-cheat measures: task completion is client-side verified
- POST /api/tasks/complete endpoint is incomplete
- No test suite

## Key Files
- [bot.js](bot.js): Telegram bot handlers and reward logic
- [server.js](server.js): REST API endpoints and MongoDB integration
- [models/User.js](models/User.js): User schema with pre-save hooks
- [middleware/auth.js](middleware/auth.js): JWT verification middleware

## Environment Variables
Required: `TELEGRAM_BOT_TOKEN`, `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `MONGODB_URI`, `JWT_SECRET`  
Optional: `WALLET_ADDRESS`