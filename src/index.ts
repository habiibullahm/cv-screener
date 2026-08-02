import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createBot } from "./bot.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env");

// Local: load .env if present. Railway: BOT_TOKEN comes from platform Variables.
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const token = process.env.BOT_TOKEN?.trim();

if (!token) {
  console.error("Missing BOT_TOKEN.");
  console.error(`Local: add BOT_TOKEN to ${envPath}`);
  console.error("Railway: set BOT_TOKEN in service Variables.");
  process.exit(1);
}

if (token.includes("your_telegram_bot_token_here") || !token.includes(":")) {
  console.error("BOT_TOKEN does not look like a BotFather token.");
  console.error("Expected format: 123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  process.exit(1);
}

const bot = createBot(token);

await bot.api.setMyCommands([
  { command: "start", description: "Mulai & cara pakai" },
  { command: "screen", description: "Bandingkan JD dengan CV" },
  { command: "cancel", description: "Batalkan session" },
  { command: "help", description: "Bantuan singkat" },
]);

bot.start({
  onStart: (info) => {
    console.log(`CV Screener bot @${info.username} is running (polling).`);
    if (fs.existsSync(envPath)) {
      console.log(`Loaded local env from ${envPath}`);
    } else {
      console.log("Using platform environment variables (no local .env).");
    }
  },
});
