import type { Express, Request, Response } from "express";
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ActivityHandler,
  TurnContext,
  MessageFactory,
} from "botbuilder";
import { logger } from "../logger";

const BOT_APP_ID = process.env.TEAMS_BOT_APP_ID || "";
const BOT_APP_PASSWORD = process.env.TEAMS_BOT_APP_PASSWORD || "";
const BOT_CONFIGURED =
  !!process.env.TEAMS_BOT_APP_ID && !!process.env.TEAMS_BOT_APP_PASSWORD;

class FinAdvisorBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context: TurnContext, next) => {
      const text = (context.activity.text || "").trim().toLowerCase();
      let replyText: string;

      if (text === "help" || text.includes("help")) {
        replyText =
          "FinAdvisor Bot Commands:\n\n" +
          "- **status** — Check bot connection status\n" +
          "- **help** — Show this help message\n\n" +
          "This bot is in development. Real-time meeting recording will be available in a future release.";
      } else if (text === "status" || text.includes("status")) {
        replyText =
          `FinAdvisor Bot Status: Online\n\n` +
          `Bot ID: ${BOT_APP_ID || "(not configured)"}\n` +
          `Channel: ${context.activity.channelId || "unknown"}\n` +
          `Server Time: ${new Date().toISOString()}\n\n` +
          `Meeting recording capability: Phase 1 (webhook only)`;
      } else {
        replyText =
          "Hello! I'm the FinAdvisor Meeting Assistant Bot. " +
          "Type **help** to see available commands.";
      }

      await context.sendActivity(MessageFactory.text(replyText));
      await next();
    });

    this.onMembersAdded(async (context: TurnContext, next) => {
      for (const member of context.activity.membersAdded || []) {
        if (member.id !== context.activity.recipient?.id) {
          await context.sendActivity(
            MessageFactory.text(
              "Welcome to FinAdvisor Bot! Type **help** to see available commands.",
            ),
          );
        }
      }
      await next();
    });
  }
}

export function registerBotRoutes(app: Express) {
  const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: BOT_APP_ID,
    MicrosoftAppPassword: BOT_APP_PASSWORD,
    MicrosoftAppType: "MultiTenant",
  });

  const adapter = new CloudAdapter(botFrameworkAuth);

  adapter.onTurnError = async (context: TurnContext, error: Error) => {
    logger.error(`[teams-bot] Unhandled error: ${error.message}`);
    try {
      await context.sendActivity(
        "Sorry, something went wrong. Please try again.",
      );
    } catch (sendError: unknown) {
      const msg = sendError instanceof Error ? sendError.message : "Unknown";
      logger.error(`[teams-bot] Failed to send error message: ${msg}`);
    }
  };

  const bot = new FinAdvisorBot();

  app.post("/api/bot/messages", async (req: Request, res: Response) => {
    if (!BOT_CONFIGURED) {
      logger.warn(
        "[teams-bot] Bot credentials not configured — rejecting incoming activity",
      );
      return res.status(503).json({
        message:
          "Teams Bot is not configured. Set TEAMS_BOT_APP_ID and TEAMS_BOT_APP_PASSWORD environment variables.",
      });
    }

    try {
      await adapter.process(req, res, (context: TurnContext) =>
        bot.run(context),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error(`[teams-bot] Process error: ${message}`);
      if (!res.headersSent) {
        res
          .status(401)
          .json({
            message: "Unauthorized: Bot Framework authentication failed",
          });
      }
    }
  });

  app.get("/api/bot/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      botId: BOT_APP_ID || "(not configured)",
      configured: !!BOT_APP_ID && !!BOT_APP_PASSWORD,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      capabilities: {
        messaging: true,
        meetingJoin: false,
        realTimeMedia: false,
      },
    });
  });
}
