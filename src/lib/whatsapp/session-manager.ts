import nodeCrypto from "node:crypto";
try {
  if (typeof globalThis.crypto === "undefined" || !(globalThis.crypto as any)?.subtle) {
    Object.defineProperty(globalThis, "crypto", {
      value: (nodeCrypto as any).webcrypto || nodeCrypto,
      configurable: true,
      writable: true,
    });
  }
} catch {}

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  ConnectionState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import {
  WhatsAppConnectionState,
  WhatsAppConnectedInfo,
  WhatsAppMessagePayload,
  WhatsAppSendResult,
} from "./types";


/**
 * Encapsulates an isolated WhatsApp Baileys socket session for a specific user
 */
export class UserWhatsAppSession {
  public readonly userId: string;
  public readonly sessionDir: string;

  private sock: any | null = null;
  private connectionState: WhatsAppConnectionState = "NOT_CONNECTED";
  private qrCodeString: string | null = null;
  private qrCodeDataUrl: string | null = null;
  private qrExpiresAt: Date | null = null;
  private pairingCode: string | null = null;
  private connectedPhone: string | null = null;
  private connectedName: string | null = null;
  private connectedAt: Date | null = null;
  private lastDisconnectedAt: Date | null = null;
  private lastActiveAt: Date | null = null;
  private reconnectAttempts: number = 0;
  private errorMessage: string | null = null;
  private isConnecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(userId: string) {
    this.userId = userId;
    const baseDir = path.join(process.cwd(), "whatsapp_sessions");
    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
      } catch {}
    }
    this.sessionDir = path.join(baseDir, userId);
    if (!fs.existsSync(this.sessionDir)) {
      try {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      } catch {}
    }
  }

  /**
   * Checks if valid authentication credentials exist on disk for this user
   */
  public hasSavedAuth(): boolean {
    try {
      const credsPath = path.join(this.sessionDir, "creds.json");
      if (fs.existsSync(credsPath)) {
        const content = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
        return !!(content?.me || content?.registered || content?.account);
      }
    } catch {}
    return false;
  }

  public isConnected(): boolean {
    return this.connectionState === "CONNECTED" && !!this.sock;
  }

  public getConnectionState(): WhatsAppConnectionState {
    return this.connectionState;
  }

  public async getConnectedInfo(): Promise<WhatsAppConnectedInfo> {
    // If QR code expired, clear it
    if (this.qrExpiresAt && new Date() > this.qrExpiresAt && this.connectionState === "QR_READY") {
      this.qrCodeDataUrl = null;
      this.qrCodeString = null;
      this.connectionState = "NOT_CONNECTED";
      await this.updateDbSession();
    }

    return {
      userId: this.userId,
      phone: this.connectedPhone,
      name: this.connectedName,
      connectedAt: this.connectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      lastActiveAt: this.lastActiveAt,
      status: this.connectionState,
      qrCode: this.qrCodeDataUrl,
      qrExpiresAt: this.qrExpiresAt,
      pairingCode: this.pairingCode,
      errorMessage: this.errorMessage,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Synchronizes this user's connection status to the Supabase database
   */
  public async updateDbSession(): Promise<void> {
    try {
      if (this.userId && this.userId !== "default") {
        await prisma.whatsAppSession.upsert({
          where: { userId: this.userId },
          update: {
            status: this.connectionState,
            qrCode: this.qrCodeDataUrl,
            qrExpiresAt: this.qrExpiresAt,
            pairingCode: this.pairingCode,
            connectedPhone: this.connectedPhone,
            connectedName: this.connectedName,
            connectedAt: this.connectedAt,
            lastDisconnectedAt: this.lastDisconnectedAt,
            lastActiveAt: this.lastActiveAt || new Date(),
            reconnectAttempts: this.reconnectAttempts,
            errorMessage: this.errorMessage,
          },
          create: {
            userId: this.userId,
            status: this.connectionState,
            qrCode: this.qrCodeDataUrl,
            qrExpiresAt: this.qrExpiresAt,
            pairingCode: this.pairingCode,
            connectedPhone: this.connectedPhone,
            connectedName: this.connectedName,
            connectedAt: this.connectedAt,
            lastDisconnectedAt: this.lastDisconnectedAt,
            lastActiveAt: new Date(),
            reconnectAttempts: this.reconnectAttempts,
            errorMessage: this.errorMessage,
          },
        }).catch(() => {});
      }

      // Update legacy "default" session if this is the default session or if this session is generating QR/Pairing/Connected
      if (
        this.userId === "default" ||
        this.connectionState === "QR_READY" ||
        this.connectionState === "CONNECTED" ||
        this.connectionState === "PAIRING"
      ) {
        await prisma.whatsAppSession.upsert({
          where: { id: "default" },
          update: {
            status: this.connectionState,
            qrCode: this.qrCodeDataUrl,
            qrExpiresAt: this.qrExpiresAt,
            pairingCode: this.pairingCode,
            connectedPhone: this.connectedPhone,
            connectedName: this.connectedName,
            connectedAt: this.connectedAt,
            lastDisconnectedAt: this.lastDisconnectedAt,
            lastActiveAt: this.lastActiveAt || new Date(),
            reconnectAttempts: this.reconnectAttempts,
            errorMessage: this.errorMessage,
          },
          create: {
            id: "default",
            status: this.connectionState,
            qrCode: this.qrCodeDataUrl,
            qrExpiresAt: this.qrExpiresAt,
            pairingCode: this.pairingCode,
            connectedPhone: this.connectedPhone,
            connectedName: this.connectedName,
            connectedAt: this.connectedAt,
            lastDisconnectedAt: this.lastDisconnectedAt,
            lastActiveAt: new Date(),
            reconnectAttempts: this.reconnectAttempts,
            errorMessage: this.errorMessage,
          },
        }).catch(() => {});
      }
    } catch (err: any) {
      console.warn(`⚠️ [DB Sync Warning for User ${this.userId}]:`, err.message);
    }
  }

  /**
   * Initializes or reconnects this user's isolated WhatsApp socket
   */
  public async init(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnecting = true;
    this.connectionState = "CONNECTING";
    this.errorMessage = null;
    await this.updateDbSession();

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
      let version: any = [2, 3000, 1043857760];
      try {
        const vData = await fetchLatestBaileysVersion().catch(() => null);
        if (vData?.version) {
          version = vData.version;
        }
      } catch {}

      const logger = pino({ level: "silent" });

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.windows("Chrome"),
        connectTimeoutMs: 180000,
        defaultQueryTimeoutMs: 180000,
        keepAliveIntervalMs: 15000,
        retryRequestDelayMs: 2500,
        maxMsgRetryCount: 5,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined,
      });

      this.isConnecting = false;

      // Handle credentials update and automatic phone extraction
      this.sock.ev.on("creds.update", async () => {
        await saveCreds();
        if (state.creds?.me?.id && !this.connectedPhone) {
          const rawId = state.creds.me.id;
          this.connectedPhone = rawId ? rawId.split(":")[0].replace(/[^0-9]/g, "") : null;
          this.connectedName = state.creds.me.name || "QistFlow User";
          this.connectionState = "CONNECTED";
          this.qrCodeString = null;
          this.qrCodeDataUrl = null;
          this.qrExpiresAt = null;
          this.errorMessage = null;
          await this.updateDbSession();
        }
      });

      // Handle socket connection updates
      this.sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        // 1. QR Code generated (only when not already registered)
        if (qr && !state.creds?.registered) {
          this.qrCodeString = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
            this.qrExpiresAt = new Date(Date.now() + 60 * 1000); // 60s expiration
            console.log(`\n📲 [User ${this.userId}] WhatsApp Pairing QR Code Generated!`);
          } catch (e: any) {
            console.error(`❌ [User ${this.userId}] QR to DataURL failed:`, e.message);
            this.qrCodeDataUrl = null;
          }
          this.connectionState = "QR_READY";
          await this.updateDbSession();
        }

        // 2. Connection Closed
        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          const isRegistered = !!(state.creds?.registered || state.creds?.me || this.hasSavedAuth());
          const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
          // 408 = QR code timed out without being scanned (not an error, just need new QR)
          const isQrTimeout = statusCode === 408;

          console.log(`⚠️ [User ${this.userId}] Socket closed: statusCode=${statusCode}, shouldReconnect=${shouldReconnect}, isRegistered=${isRegistered}, isQrTimeout=${isQrTimeout}`);

          if (statusCode === DisconnectReason.loggedOut) {
            // Unlinked from WhatsApp mobile app
            await this.logout();
            return;
          }

          if (isRegistered || isRestartRequired) {
            // Handshake finalization (515) or temporary network reconnect
            this.connectionState = "RECONNECTING";
            this.sock = null;
            this.isConnecting = false;
            await this.updateDbSession();

            this.reconnectAttempts++;
            const backoffMs = Math.min(1000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 5)), 10000);
            this.reconnectTimeout = setTimeout(() => {
              this.init().catch(() => {});
            }, backoffMs);
          } else if (isQrTimeout) {
            // QR code expired (408) — reset cleanly to NOT_CONNECTED so user can request a new QR
            console.log(`🔄 [User ${this.userId}] QR code expired (408). Resetting to NOT_CONNECTED.`);
            this.connectionState = "NOT_CONNECTED";
            this.errorMessage = null;
            this.qrCodeString = null;
            this.qrCodeDataUrl = null;
            this.qrExpiresAt = null;
            this.sock = null;
            this.isConnecting = false;
            await this.updateDbSession();
          } else {
            this.connectionState = "ERROR";
            this.errorMessage = lastDisconnect?.error?.message || "Connection closed";
            this.qrCodeString = null;
            this.qrCodeDataUrl = null;
            this.qrExpiresAt = null;
            this.sock = null;
            this.isConnecting = false;
            this.lastDisconnectedAt = new Date();
            await this.updateDbSession();
          }
        }
        // 3. Connection Open / Connected
        else if (connection === "open") {
          this.connectionState = "CONNECTED";
          this.errorMessage = null;
          this.qrCodeString = null;
          this.qrCodeDataUrl = null;
          this.qrExpiresAt = null;
          this.pairingCode = null;
          this.isConnecting = false;
          this.connectedAt = new Date();
          this.lastActiveAt = new Date();
          this.reconnectAttempts = 0;

          if (this.sock?.user) {
            const rawId = this.sock.user.id;
            this.connectedPhone = rawId ? rawId.split(":")[0].replace(/[^0-9]/g, "") : null;
            this.connectedName = this.sock.user.name || "QistFlow User";
            console.log(`\n🎉 [User ${this.userId}] WhatsApp Connected Successfully as: ${this.connectedName} (${this.connectedPhone})\n`);
          }

          await this.updateDbSession();
        }
      });
    } catch (err: any) {
      this.isConnecting = false;
      this.connectionState = "ERROR";
      this.errorMessage = err.message || "Failed to initialize WhatsApp socket";
      console.error(`❌ [User ${this.userId} Init Error]:`, err.message);
      await this.updateDbSession();
    }
  }

  /**
   * Requests an 8-digit WhatsApp pairing code for phone-based pairing
   */
  public async requestPairingCode(phoneNumber: string): Promise<string> {
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
      cleanPhone = "92" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
      cleanPhone = "92" + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error("Invalid phone number. Must include country code without symbols (e.g. 923001234567).");
    }

    if (this.hasSavedAuth()) {
      await this.disconnect();
    }

    this.connectionState = "PAIRING";
    this.pairingCode = null;
    this.qrCodeDataUrl = null;
    this.qrCodeString = null;
    await this.updateDbSession();

    await this.init();

    // Wait for socket to be initialized and WebSocket handshake to begin
    let tries = 0;
    while (!this.sock && tries < 40) {
      await new Promise((r) => setTimeout(r, 250));
      tries++;
    }

    if (!this.sock) {
      throw new Error("WhatsApp socket initialization timed out.");
    }

    // Wait 3.5 seconds for Baileys WebSocket handshake
    await new Promise((r) => setTimeout(r, 3500));

    try {
      const code = await this.sock.requestPairingCode(cleanPhone);
      this.pairingCode = code;
      this.connectionState = "PAIRING";
      await this.updateDbSession();
      return code;
    } catch (err: any) {
      this.connectionState = "ERROR";
      this.errorMessage = err.message;
      await this.updateDbSession();
      throw err;
    }
  }

  /**
   * Temporary Disconnect: Closes socket cleanly, preserves saved auth credentials on disk
   */
  public async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      if (this.sock) {
        this.sock.ev.removeAllListeners("connection.update");
        this.sock.ev.removeAllListeners("creds.update");
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch {}

    this.isConnecting = false;
    this.connectionState = "DISCONNECTED";
    this.qrCodeString = null;
    this.qrCodeDataUrl = null;
    this.qrExpiresAt = null;
    this.pairingCode = null;
    this.lastDisconnectedAt = new Date();
    await this.updateDbSession();
    console.log(`🛑 [User ${this.userId}] WhatsApp session disconnected temporarily (credentials preserved).`);
  }

  /**
   * Complete Logout & Unlink: Closes socket, deletes auth directory, resets DB record to LOGGED_OUT
   */
  public async logout(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      if (this.sock) {
        try {
          await this.sock.logout();
        } catch {}
        this.sock.ev.removeAllListeners("connection.update");
        this.sock.ev.removeAllListeners("creds.update");
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch {}

    // Delete session files
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
      }
    } catch {}

    this.isConnecting = false;
    this.connectionState = "LOGGED_OUT";
    this.qrCodeString = null;
    this.qrCodeDataUrl = null;
    this.qrExpiresAt = null;
    this.pairingCode = null;
    this.connectedPhone = null;
    this.connectedName = null;
    this.connectedAt = null;
    this.lastDisconnectedAt = new Date();
    this.reconnectAttempts = 0;
    this.errorMessage = null;

    await this.updateDbSession();
    console.log(`🗑️ [User ${this.userId}] WhatsApp session logged out & credentials purged.`);
  }

  /**
   * Sends a message directly through this user's active WhatsApp socket
   */
  public async sendDirectMessage(recipientPhone: string, messageText: string): Promise<WhatsAppSendResult> {
    if (!this.isConnected() || !this.sock) {
      return {
        success: false,
        error: `User WhatsApp is not connected (current state: ${this.connectionState})`,
        timestamp: new Date(),
      };
    }

    const cleanPhone = recipientPhone.replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      return {
        success: false,
        error: `Invalid recipient phone number: "${recipientPhone}"`,
        timestamp: new Date(),
      };
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      // Check if recipient is on WhatsApp
      const [onWa] = await this.sock.onWhatsApp(cleanPhone).catch(() => [null]);
      if (onWa && !onWa.exists) {
        return {
          success: false,
          error: `Phone number ${cleanPhone} is not registered on WhatsApp`,
          timestamp: new Date(),
        };
      }

      const sentMsg = await this.sock.sendMessage(jid, { text: messageText });
      this.lastActiveAt = new Date();

      return {
        success: true,
        messageId: sentMsg?.key?.id,
        timestamp: new Date(),
      };
    } catch (err: any) {
      console.error(`❌ [User ${this.userId} Send Error to ${cleanPhone}]:`, err.message);
      return {
        success: false,
        error: err.message || "Failed to send WhatsApp message",
        timestamp: new Date(),
      };
    }
  }
}

/**
 * Singleton Multi-User WhatsApp Session Manager
 */
class WhatsAppSessionManager {
  private sessions = new Map<string, UserWhatsAppSession>();
  private connectionLocks = new Map<string, Promise<any>>();

  /**
   * Gets or instantiates a UserWhatsAppSession for a given userId
   */
  public getSession(userId: string): UserWhatsAppSession {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, new UserWhatsAppSession(userId));
    }
    return this.sessions.get(userId)!;
  }

  /**
   * Initiates connection for a specific user with race-condition lock protection
   */
  public async connectUser(
    userId: string,
    forceFreshQR: boolean = false
  ): Promise<{ status: WhatsAppConnectionState; qrCode: string | null }> {
    const existingLock = this.connectionLocks.get(userId);
    if (existingLock) {
      return existingLock;
    }

    const connectPromise = (async () => {
      try {
        const session = this.getSession(userId);

        if (session.isConnected()) {
          const info = await session.getConnectedInfo();
          return { status: info.status, qrCode: null };
        }

        if (forceFreshQR) {
          await session.logout();
        }

        await session.init();

        // Wait up to 5 seconds to capture initial QR or Connection
        let elapsed = 0;
        while (elapsed < 5000) {
          const info = await session.getConnectedInfo();
          if (info.status === "CONNECTED" || info.qrCode || info.status === "QR_READY") {
            return { status: info.status, qrCode: info.qrCode || null };
          }
          await new Promise((r) => setTimeout(r, 300));
          elapsed += 300;
        }

        const info = await session.getConnectedInfo();
        return { status: info.status, qrCode: info.qrCode || null };
      } finally {
        this.connectionLocks.delete(userId);
      }
    })();

    this.connectionLocks.set(userId, connectPromise);
    return connectPromise;
  }

  public async disconnectUser(userId: string): Promise<void> {
    const session = this.getSession(userId);
    await session.disconnect();
  }

  public async logoutUser(userId: string): Promise<void> {
    const session = this.getSession(userId);
    await session.logout();
    this.sessions.delete(userId);
  }

  public async getUserStatus(userId: string): Promise<WhatsAppConnectedInfo> {
    const session = this.getSession(userId);
    return session.getConnectedInfo();
  }

  public async requestPairingCode(userId: string, phone: string): Promise<string> {
    const session = this.getSession(userId);
    return session.requestPairingCode(phone);
  }

  public async sendMessage(userId: string, payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    const session = this.getSession(userId);
    return session.sendDirectMessage(payload.recipientPhone, payload.messageText);
  }

  /**
   * Restores and automatically reconnects all users who have saved credentials on worker startup
   */
  public async restoreAllActiveSessions(): Promise<void> {
    console.log("🔍 [Session Manager] Restoring active user sessions from disk...");
    const baseDir = path.join(process.cwd(), "whatsapp_sessions");
    if (!fs.existsSync(baseDir)) return;

    const userDirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const userId of userDirs) {
      const session = this.getSession(userId);
      if (session.hasSavedAuth()) {
        console.log(`🔄 [Session Manager] Restoring session for user: ${userId}`);
        session.init().catch((err) => {
          console.warn(`⚠️ [Session Manager] Could not auto-reconnect user ${userId}:`, err.message);
        });
      }
    }
  }

  public getAllActiveSessions(): Map<string, UserWhatsAppSession> {
    return this.sessions;
  }
}

export const waSessionManager = new WhatsAppSessionManager();
