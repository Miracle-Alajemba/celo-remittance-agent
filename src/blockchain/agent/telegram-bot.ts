//Got this from Google Gemini Pro
/**
 * Telegram Bot Handler
 * Integrates the Celo Remittance Agent with Telegram
 * Users can send natural language remittance requests via Telegram
 */

import { Telegraf, Context, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
import https from 'https';
import { AgentOrchestrator, AgentResponse } from './orchestrator';
import { getUser } from './user-profile';
import {
  completeWalletApprovalSession,
  createWalletApprovalSession,
  failWalletApprovalSession,
  getWalletApprovalSession,
} from './wallet-approval-session';
import {
  completeWalletAuthSession,
  createWalletAuthSession,
  failWalletAuthSession,
  getWalletAuthSession,
} from './wallet-auth-session';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;



export interface TelegramUser {
  id: number;
  firstName: string;
  username?: string;
  walletAddress?: string;
}

export class TelegramBotHandler {
  bot: Telegraf<Context>;
  agents: Map<number, AgentOrchestrator> = new Map();
  users: Map<number, TelegramUser> = new Map();
  private readonly telegramAgent: https.Agent;
  private started = false;
  private botUsername: string | null = process.env.TELEGRAM_BOT_USERNAME || null;

  private readonly callbackActionMap: Record<string, string> = {
    transfer_confirm: 'yes, send it',
    transfer_cancel: 'cancel',
    transfer_compare: 'view full comparison',
    swap_execute: 'execute swap',
    swap_cancel: 'cancel',
    check_balance: 'check my balance',
    view_history: 'show my transaction history',
    my_wallet: 'wallet',
    send_money: 'send money',
    send_again: 'send again',
    try_another_swap: 'try another swap',
    compare_fees: 'compare fees',
  };

  constructor() {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('❌ TELEGRAM_BOT_TOKEN is missing in .env file.');
    }

    console.log('[Telegram] Initializing Bot...');
    // Force IPv4 for Telegram API calls. In this environment, Node HTTPS
    // requests to api.telegram.org can time out on default resolution.
    this.telegramAgent = new https.Agent({ family: 4 });
    this.bot = new Telegraf(TELEGRAM_BOT_TOKEN, {
      telegram: {
        agent: this.telegramAgent,
      },
    });
    this.setupHandlers();
  }

  /**
   * Setup Telegram command and message handlers
   */
  private setupHandlers() {
    const withRecovery = (
      handler: (ctx: Context) => Promise<void>,
    ) => async (ctx: Context) => {
      try {
        await handler(ctx);
      } catch (error: any) {
        console.error('[Telegram Handler Error]', error);
        await ctx.reply(`⚠️ Something went wrong. Please try again.`).catch(() => {});
      }
    };

    // 1. /start command
    this.bot.command('start', withRecovery(async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearMemory();

      // Trigger the greeting flow in the Orchestrator
      const response = await agent.processMessage('hello');
      await this.sendResponse(ctx, response);
    }));

    // 2. /help command
    this.bot.command('help', withRecovery(async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearPendingTransferFlow();

      const response = await agent.processMessage('help');
      await this.sendResponse(ctx, response);
    }));

    // 3. /balance command
    this.bot.command('balance', withRecovery(async (ctx: Context) => {
      await this.sendHostedSafeBalanceResponse(ctx);
    }));

    // 4. /history command
    this.bot.command('history', withRecovery(async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearPendingTransferFlow();

      const response = await agent.processMessage('Show my transaction history');
      await this.sendResponse(ctx, response);
    }));

    // 5. /wallet command
    this.bot.command('wallet', withRecovery(async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearPendingTransferFlow();

      const response = await agent.processMessage('wallet');
      await this.sendResponse(ctx, response);
    }));

    // 5. Handle Text Messages (Natural Language)
    this.bot.on('text', withRecovery(async (ctx: Context) => {
      const userId = ctx.from!.id;
      // @ts-ignore - Telegraf types sometimes miss 'text' on message
      const userMessage = ctx.message.text;

      if (!userMessage) return;
      if (userMessage.trim().startsWith('/')) return;

      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(userId);

      await ctx.sendChatAction('typing').catch((error) => {
        console.warn('[Telegram] Failed to send chat action:', error);
      });

      if (this.isBalanceShortcut(userMessage)) {
        agent.clearPendingTransferFlow();
        await this.sendHostedSafeBalanceResponse(ctx);
        return;
      }

      // Process message through agent
      const response = await agent.processMessage(userMessage);

      // Send formatted response
      await this.sendResponse(ctx, response);

      console.log(`[Telegram] ${user.firstName}: ${userMessage}`);
    }));

    // 6. Handle Button Clicks (Callbacks)
    // This handles when a user clicks "✅ Confirm" or "❌ Cancel"
    this.bot.on('callback_query', withRecovery(async (ctx) => {
        const userId = ctx.from!.id;
        // @ts-ignore
        const actionData = ctx.callbackQuery.data; // e.g., "Confirm"

        // Remove the loading clock on the button
      await ctx.answerCbQuery().catch(() => {});

        const user = this.registerUser(ctx);
        const agent = this.getOrCreateAgent(userId);

        if (!actionData) return;
        const mappedAction = this.callbackActionMap[actionData] || actionData;
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        await ctx.sendChatAction('typing').catch((error) => {
          console.warn('[Telegram] Failed to send chat action:', error);
        });

        // Feed the button click back into the AI as if the user typed it
        const response = await agent.processMessage(mappedAction);

        await this.sendResponse(ctx, response);
        console.log(`[Telegram] ${user.firstName} clicked: ${actionData} -> ${mappedAction}`);
    }));

    // Error handling
    this.bot.catch((err: any, ctx: Context) => {
      console.error('[Telegram Bot Error]', err);
      // Only reply if we haven't already replied
      ctx.reply(`⚠️ Something went wrong. Please try again.`).catch(() => {});
    });
  }

  /**
   * Helper: Sends the Orchestrator response to Telegram
   * Handles Markdown formatting and creates Clickable Buttons
   */
  private async sendResponse(ctx: Context, response: AgentResponse) {
      const userId = ctx.from?.id;
      const walletAuthUrl =
        userId && response.type === 'wallet_auth'
          ? this.createWalletAuthUrl(userId)
          : null;
      const walletApprovalUrl =
        userId && response.type === 'transfer_preview'
          ? this.createWalletApprovalUrl(userId)
          : null;

      // 1. Format Text: Convert **bold** to Telegram's *bold*
      // Note: We avoid special chars in MarkdownMode to prevent crashing
      let text = response.message
          .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold
          .replace(/__(.*?)__/g, '_$1_');    // Italics

      if (walletAuthUrl) {
        text += '\n\n🔐 *Ready to connect?* Use the wallet button below to sign in securely.';
      }

      if (walletApprovalUrl) {
        text += '\n\n🔐 *Ready to send?* Use the wallet button below to approve this transfer.';
      }

      // 2. Create Buttons (Inline Keyboard)
      let extra: any = { parse_mode: 'Markdown' };

      if (response.suggestedActions && response.suggestedActions.length > 0) {
          const filteredActions = walletApprovalUrl
            ? response.suggestedActions.filter(
                (action) => this.getCallbackData(action) !== 'transfer_confirm',
              )
            : walletAuthUrl
              ? response.suggestedActions.filter(
                  (action) => this.getCallbackData(action) !== 'connect_wallet',
                )
              : response.suggestedActions;

          const buttons: any[] = filteredActions.map(action =>
              Markup.button.callback(action, this.getCallbackData(action))
          );

          if (walletAuthUrl) {
            buttons.unshift(
              Markup.button.url('🔐 Connect wallet', walletAuthUrl),
            );
          }

          if (walletApprovalUrl) {
            buttons.unshift(
              Markup.button.url('🔐 Connect wallet', walletApprovalUrl),
            );
          }

          extra.reply_markup = {
              inline_keyboard: this.chunkArray(buttons, 2)
          };
      }

      // 3. Send
      try {
          await ctx.reply(text, extra);
      } catch (e) {
          // Fallback: If Markdown fails (often due to special characters like _ or * inside names), sends plain text
          console.warn("[Telegram] Markdown failed, sending plain text.");
          delete extra.parse_mode;
          await ctx.reply(response.message, extra);
      }
  }

  /**
   * Helper: Get or Create Agent for a User
   */
  private getOrCreateAgent(userId: number): AgentOrchestrator {
    if (!this.agents.has(userId)) {
      this.agents.set(userId, new AgentOrchestrator(`telegram_${userId}`));
    }
    return this.agents.get(userId)!;
  }

  /**
   * Helper: Register user in memory
   */
  private registerUser(ctx: Context): TelegramUser {
      const id = ctx.from!.id;
      if (!this.users.has(id)) {
          this.users.set(id, {
              id,
              firstName: ctx.from!.first_name,
              username: ctx.from!.username
          });
      }
      return this.users.get(id)!;
  }

  /**
   * Utility: Split array into chunks (for button rows)
   */
  private chunkArray(myArray: any[], chunk_size: number) {
      let index = 0;
      const arrayLength = myArray.length;
      const tempArray = [];

      for (index = 0; index < arrayLength; index += chunk_size) {
          const myChunk = myArray.slice(index, index + chunk_size);
          tempArray.push(myChunk);
      }
      return tempArray;
  }

  private getCallbackData(action: string): string {
    const normalized = action.trim().toLowerCase();
    const entries: Array<[RegExp, string]> = [
      [/connect wallet/, 'connect_wallet'],
      [/yes.*send|sí.*enviar|sim.*enviar|oui.*envoyer/, 'transfer_confirm'],
      [/cancel|cancelar|annuler/, 'transfer_cancel'],
      [/view full comparison|ver comparación completa|ver comparação completa|voir comparaison complète/, 'transfer_compare'],
      [/execute swap/, 'swap_execute'],
      [/check balance/, 'check_balance'],
      [/view history/, 'view_history'],
      [/my wallet/, 'my_wallet'],
      [/send money/, 'send_money'],
      [/send again/, 'send_again'],
      [/try another swap/, 'try_another_swap'],
      [/compare fees/, 'compare_fees'],
    ];

    for (const [pattern, callbackData] of entries) {
      if (pattern.test(normalized)) {
        return callbackData;
      }
    }

    return normalized.replace(/[^a-z0-9]+/g, '_').slice(0, 60) || 'action';
  }

  private isBalanceShortcut(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return [
      'balance',
      'check balance',
      'check my balance',
      'show balance',
      'show my balance',
      'my balance',
    ].includes(normalized);
  }

  private async sendHostedSafeBalanceResponse(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) {
      await ctx.reply('⚠️ Could not identify your Telegram account. Please try again.').catch(() => {});
      return;
    }

    const user = this.registerUser(ctx);
    const agent = this.getOrCreateAgent(user.id);
    agent.clearPendingTransferFlow();

    const profile = await getUser(`telegram_${telegramUserId}`);
    const session = createWalletAuthSession({
      channel: 'telegram',
      telegramUserId,
      language: profile?.language || 'en',
      reason: 'balance',
    });

    const authUrl = `${this.getPublicAppUrl()}/connect?authSession=${encodeURIComponent(session.id)}`;
    await ctx.reply(
      '🔐 To check your balance, connect and sign with your wallet first. After signing, I’ll bring the verified balance back here in Telegram.',
      {
      reply_markup: {
        inline_keyboard: [[Markup.button.url('🔐 Connect wallet', authUrl)]],
      },
    });
  }

  private getPublicAppUrl(): string {
    return (
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL ||
      `http://localhost:${process.env.PORT || 3001}`
    );
  }

  private createWalletApprovalUrl(userId: number): string | null {
    const agent = this.getOrCreateAgent(userId);
    const approvalContext = agent.getPendingWalletApprovalContext();
    if (!approvalContext) return null;

    const session = createWalletApprovalSession({
      channel: 'telegram',
      telegramUserId: userId,
      language: approvalContext.language,
      requestedTransfer: approvalContext.requestedTransfer,
      executionPlan: approvalContext.executionPlan,
    });

    return `${this.getPublicAppUrl()}/connect?session=${encodeURIComponent(session.id)}`;
  }

  private createWalletAuthUrl(userId: number): string | null {
    const agent = this.getOrCreateAgent(userId);
    const authContext = agent.getPendingWalletAuthContext();
    if (!authContext) return null;

    const session = createWalletAuthSession({
      channel: 'telegram',
      telegramUserId: userId,
      language: authContext.language,
      reason: authContext.reason,
    });

    return `${this.getPublicAppUrl()}/connect?authSession=${encodeURIComponent(session.id)}`;
  }

  private async sendDirectResponse(
    telegramUserId: number,
    response: AgentResponse,
  ): Promise<void> {
    let text = response.message
      .replace(/\*\*(.*?)\*\*/g, '*$1*')
      .replace(/__(.*?)__/g, '_$1_');

    const extra: any = { parse_mode: 'Markdown' };
    if (response.suggestedActions && response.suggestedActions.length > 0) {
      const buttons = response.suggestedActions.map((action) =>
        Markup.button.callback(action, this.getCallbackData(action)),
      );
      extra.reply_markup = {
        inline_keyboard: this.chunkArray(buttons, 2),
      };
    }

    try {
      await this.bot.telegram.sendMessage(telegramUserId, text, extra);
    } catch (_error) {
      delete extra.parse_mode;
      await this.bot.telegram.sendMessage(
        telegramUserId,
        response.message,
        extra,
      );
    }
  }

  async handleWalletApproval(sessionId: string, walletAddress: string) {
    const session = getWalletApprovalSession(sessionId);
    if (!session) {
      throw new Error('Wallet approval session not found.');
    }
    if (session.channel !== 'telegram' || session.telegramUserId === undefined) {
      throw new Error('Telegram wallet approval session not found.');
    }

    const agent = this.getOrCreateAgent(session.telegramUserId);
    const response = await agent.executeApprovedPendingTransfer(walletAddress);
    if (response.type === 'receipt') {
      completeWalletApprovalSession({
        sessionId,
        txHash: response.data?.blockchain?.txHash,
        receiptMessage: response.message,
      });
    } else if (response.type === 'error') {
      failWalletApprovalSession({
        sessionId,
        error: response.message,
        receiptMessage: response.message,
      });
    }

    await this.sendDirectResponse(session.telegramUserId, response);
    return response;
  }

  async handleWalletExecutionCompletion(params: {
    sessionId: string;
    walletAddress: string;
    txHash: string;
    blockNumber?: number;
    gasUsed?: string;
    receiveAmount?: string;
    receiveCurrency?: string;
  }) {
    const session = getWalletApprovalSession(params.sessionId);
    if (!session) {
      throw new Error("Wallet approval session not found.");
    }
    if (session.channel !== 'telegram' || session.telegramUserId === undefined) {
      throw new Error('Telegram wallet approval session not found.');
    }

    const agent = this.getOrCreateAgent(session.telegramUserId);
    const response = await agent.finalizeWalletExecutedPendingTransfer({
      walletAddress: params.walletAddress,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      gasUsed: params.gasUsed,
      receiveAmount: params.receiveAmount,
      receiveCurrency: params.receiveCurrency,
    });

    if (response.type === "receipt") {
      completeWalletApprovalSession({
        sessionId: params.sessionId,
        txHash: params.txHash,
        receiptMessage: response.message,
      });
    } else if (response.type === "error") {
      failWalletApprovalSession({
        sessionId: params.sessionId,
        error: response.message,
        receiptMessage: response.message,
      });
    }

    await this.sendDirectResponse(session.telegramUserId, response);
    return response;
  }

  async handleWalletAuth(sessionId: string, walletAddress: string) {
    const session = getWalletAuthSession(sessionId);
    if (!session) {
      throw new Error('Wallet sign-in session not found.');
    }
    if (session.channel !== 'telegram' || session.telegramUserId === undefined) {
      throw new Error('Telegram wallet sign-in session not found.');
    }

    const agent = this.getOrCreateAgent(session.telegramUserId);
    const response = await agent.completeWalletSignIn(walletAddress, session.reason);

    if (response.type === 'error') {
      failWalletAuthSession({
        sessionId,
        error: response.message,
        receiptMessage: response.message,
      });
    } else {
      completeWalletAuthSession({
        sessionId,
        receiptMessage: response.message,
      });
    }

    await this.sendDirectResponse(session.telegramUserId, response);
    return response;
  }

  getTelegramBotUrl(): string {
    const username = this.botUsername || process.env.TELEGRAM_BOT_USERNAME || 'CeloRemit_Bot';
    return `https://t.me/${username}`;
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      if (this.started) {
        return true;
      }
      const botInfo = await this.bot.telegram.getMe();
      this.botUsername = botInfo.username || this.botUsername;
      console.log(`
✅ Telegram Bot Started
────────────────────────────────────────
🤖 Bot: @${botInfo.username}
────────────────────────────────────────
      `);

      await this.bot.launch({ dropPendingUpdates: true });
      this.started = true;

      // Graceful shutdown
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
      return true;
    } catch (error) {
      console.error('[Telegram] Failed to start bot:', error);
      throw error;
    }
  }
}

// Singleton instance
let telegramBot: TelegramBotHandler | null = null;

export function getTelegramBot(): TelegramBotHandler {
  if (!telegramBot) {
    telegramBot = new TelegramBotHandler();
  }
  return telegramBot;
}

export async function startTelegramBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set. Skipping bot startup.');
    return null;
  }

  const bot = getTelegramBot();
  await bot.start();
  return bot;
}
