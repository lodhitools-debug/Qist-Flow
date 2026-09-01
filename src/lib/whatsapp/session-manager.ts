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

// ─────────────────────────────────────────────────────────────────────────────
// Per-user isolated WhatsApp session
// ─────────────────────────────────────────────────────────────────────────────

export class UserWhatsAppSession {
  public readonly userId: string;
  public readonly tenantId: string;
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

  // Lifecycle guards
  private isConnecting: boolean = false;
  private isLoggedOut: boolean = false;           // Prevents any re-init after logout
  private userRequestedDisconnect: boolean = false; // Prevents auto-reconnect after user disconnect
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private qrWatchdogTimeout: NodeJS.Timeout | null = null;

  constructor(userId: string, tenantId: string = "default") {
    this.userId = userId;
    this.tenantId = tenantId;
    const baseDir = path.join(process.cwd(), "whatsapp_sessions");
    if (!fs.existsSync(baseDir)) {
      try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}
    }
    this.sessionDir = path.join(baseDir, userId);
    if (!fs.existsSync(this.sessionDir)) {
      try { fs.mkdirSync(this.sessionDir, { recursive: true }); } catch {}
    }
  }

  // ── Public state accessors ────────────────────────────────────────────────

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

  public isIntentionallyLoggedOut(): boolean {
    return this.isLoggedOut;
  }

  public async getConnectedInfo(): Promise<WhatsAppConnectedInfo> {
    // Clear expired QR
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

  // ── DB sync — ONLY writes to this user's own row, NEVER to "default" ──────

  public async updateDbSession(): Promise<void> {
    if (!this.userId || this.userId === "default") return;
    try {
      await prisma.whatsAppSession.upsert({
        where: { userId: this.userId },
        update: {
          tenantId: this.tenantId, // ← Multi-tenant isolation
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
          updatedAt: new Date(),
        },
        create: {
          userId: this.userId,
          tenantId: this.tenantId, // ← Multi-tenant isolation
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
      }).catch((err) => {
        console.warn(`⚠️ [DB Sync Warning for User ${this.userId}]:`, err.message);
      });
    } catch (err: any) {
      console.warn(`⚠️ [DB Sync Error for User ${this.userId}]:`, err.message);
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  public clearTimers() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.qrWatchdogTimeout) {
      clearTimeout(this.qrWatchdogTimeout);
      this.qrWatchdogTimeout = null;
    }
  }

  public destroySocket() {
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
    }
  }

  // ── QR watchdog: if no QR arrives within 30s, reset to NOT_CONNECTED ──────

  private startQrWatchdog() {
    this.clearTimers();
    this.qrWatchdogTimeout = setTimeout(async () => {
      if (this.connectionState === "CONNECTING" || this.connectionState === "INIT_QR") {
        console.warn(`⏱️ [User ${this.userId}] QR watchdog triggered — no QR within 30s. Resetting.`);
        this.destroySocket();
        this.isConnecting = false;
        this.connectionState = "NOT_CONNECTED";
        this.errorMessage = null;
        await this.updateDbSession();
      }
    }, 30_000);
  }

  // ── Core init / socket creation ───────────────────────────────────────────

  public async init(): Promise<void> {
    // Guards
    if (this.isLoggedOut) {
      console.log(`🚫 [User ${this.userId}] init() blocked — user is logged out.`);
      return;
    }
    if (this.isConnecting) {
      console.log(`⏳ [User ${this.userId}] init() skipped — already connecting.`);
      return;
    }
    if (this.isConnected()) {
      console.log(`✅ [User ${this.userId}] init() skipped — already connected.`);
      return;
    }

    // Destroy any stale socket before creating a new one
    this.destroySocket();
    this.clearTimers();

    this.isConnecting = true;
    this.connectionState = "CONNECTING";
    this.errorMessage = null;
    this.userRequestedDisconnect = false;
    await this.updateDbSession();

    // Start QR watchdog
    this.startQrWatchdog();

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
      let version: any = [2, 3000, 1043857760];
      try {
        const vData = await fetchLatestBaileysVersion().catch(() => null);
        if (vData?.version) version = vData.version;
      } catch {}

      const logger = pino({ level: "silent" });

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.windows("Chrome"),
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 15_000,
        retryRequestDelayMs: 2_000,
        maxMsgRetryCount: 3,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined,
      });

      this.isConnecting = false;

      // Credentials saved → extract phone
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
          this.clearTimers();
          await this.updateDbSession();
        }
      });

      // Connection state updates
      this.sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code generated
        if (qr && !state.creds?.registered) {
          this.clearTimers(); // Cancel watchdog — QR arrived
          this.qrCodeString = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
            this.qrExpiresAt = new Date(Date.now() + 60_000);
            console.log(`📲 [User ${this.userId}] QR Code Generated — expires in 60s`);
          } catch (e: any) {
            console.error(`❌ [User ${this.userId}] QR to DataURL failed:`, e.message);
            this.qrCodeDataUrl = null;
          }
          this.connectionState = "QR_READY";
          await this.updateDbSession();

          // Auto-refresh QR after expiry
          setTimeout(async () => {
            if (this.connectionState === "QR_READY" && !this.isConnected()) {
              console.log(`🔄 [User ${this.userId}] QR expired — requesting fresh QR...`);
              this.destroySocket();
              this.isConnecting = false;
              this.connectionState = "NOT_CONNECTED";
              this.qrCodeDataUrl = null;
              this.qrCodeString = null;
              this.qrExpiresAt = null;
              await this.updateDbSession();
              // Re-init to get a fresh QR
              if (!this.isLoggedOut && !this.userRequestedDisconnect) {
                setTimeout(() => this.init().catch(() => {}), 500);
              }
            }
          }, 62_000);
        }

        // Connection closed
        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          console.log(`⚠️ [User ${this.userId}] Socket closed: code=${statusCode}`);
          this.clearTimers();
          this.destroySocket();
          this.isConnecting = false;

          // Logged out from phone
          if (statusCode === DisconnectReason.loggedOut) {
            await this.logout();
            return;
          }

          // User intentionally disconnected — do NOT reconnect
          if (this.userRequestedDisconnect) {
            console.log(`🛑 [User ${this.userId}] User-requested disconnect — not reconnecting.`);
            this.connectionState = "DISCONNECTED";
            this.lastDisconnectedAt = new Date();
            await this.updateDbSession();
            return;
          }

          // QR timed out without scan (408)
          if (statusCode === 408) {
            console.log(`🔄 [User ${this.userId}] QR expired (408) — resetting to NOT_CONNECTED.`);
            this.connectionState = "NOT_CONNECTED";
            this.qrCodeString = null;
            this.qrCodeDataUrl = null;
            this.qrExpiresAt = null;
            this.errorMessage = null;
            await this.updateDbSession();
            return;
          }

          // Transient error / restart required — reconnect with backoff
          const isRegistered = !!(state.creds?.registered || state.creds?.me || this.hasSavedAuth());
          const isRestart = statusCode === DisconnectReason.restartRequired || statusCode === 515;

          if (isRegistered || isRestart) {
            this.connectionState = "RECONNECTING";
            this.reconnectAttempts++;
            const backoffMs = Math.min(1_000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 6)), 15_000);
            console.log(`🔄 [User ${this.userId}] Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts})...`);
            await this.updateDbSession();
            this.reconnectTimeout = setTimeout(() => {
              if (!this.isLoggedOut && !this.userRequestedDisconnect) {
                this.init().catch(() => {});
              }
            }, backoffMs);
          } else {
            this.connectionState = "ERROR";
            this.errorMessage = lastDisconnect?.error?.message || "Connection closed unexpectedly";
            this.lastDisconnectedAt = new Date();
            await this.updateDbSession();
          }
        }

        // Successfully connected / open
        else if (connection === "open") {
          this.clearTimers();
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
            console.log(`🎉 [User ${this.userId}] Connected as: ${this.connectedName} (${this.connectedPhone})`);
          }

          await this.updateDbSession();
        }
      });
    } catch (err: any) {
      this.clearTimers();
      this.destroySocket();
      this.isConnecting = false;
      this.connectionState = "ERROR";
      this.errorMessage = err.message || "Failed to initialize WhatsApp socket";
      console.error(`❌ [User ${this.userId}] Init error:`, err.message);
      await this.updateDbSession();
    }
  }

  // ── Pairing code ──────────────────────────────────────────────────────────

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (this.isLoggedOut) throw new Error("Session is logged out. Please reconnect.");

    let cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
      cleanPhone = "92" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
      cleanPhone = "92" + cleanPhone;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error("Invalid phone number. Must include country code (e.g. 923001234567).");
    }

    // If already connected with saved auth, disconnect first
    if (this.hasSavedAuth()) {
      await this.disconnect();
    }

    this.connectionState = "PAIRING";
    this.pairingCode = null;
    this.qrCodeDataUrl = null;
    this.qrCodeString = null;
    await this.updateDbSession();

    await this.init();

    // Wait for socket to be ready
    let tries = 0;
    while (!this.sock && tries < 40) {
      await new Promise((r) => setTimeout(r, 250));
      tries++;
    }
    if (!this.sock) throw new Error("WhatsApp socket initialization timed out.");

    // Wait for WebSocket handshake
    await new Promise((r) => setTimeout(r, 3_500));

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

  // ── Disconnect: temporary — preserves credentials ─────────────────────────

  public async disconnect(): Promise<void> {
    this.userRequestedDisconnect = true;
    this.clearTimers();
    this.destroySocket();

    this.isConnecting = false;
    this.connectionState = "DISCONNECTED";
    this.qrCodeString = null;
    this.qrCodeDataUrl = null;
    this.qrExpiresAt = null;
    this.pairingCode = null;
    this.lastDisconnectedAt = new Date();
    await this.updateDbSession();
    console.log(`🛑 [User ${this.userId}] Disconnected (credentials preserved).`);
  }

  // ── Logout / Change Number: wipes all credentials and state ───────────────

  public async logout(): Promise<void> {
    this.isLoggedOut = true;
    this.userRequestedDisconnect = true;
    this.clearTimers();

    try {
      if (this.sock) {
        try { await this.sock.logout(); } catch {}
      }
    } catch {}
    this.destroySocket();

    // Wipe session files from disk
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
    console.log(`🗑️ [User ${this.userId}] Logged out & credentials purged.`);
  }

  // ── Send message ──────────────────────────────────────────────────────────

  public async sendDirectMessage(recipientPhone: string, messageText: string): Promise<WhatsAppSendResult> {
    if (!this.isConnected() || !this.sock) {
      return {
        success: false,
        error: `WhatsApp not connected for this user (state: ${this.connectionState})`,
        timestamp: new Date(),
      };
    }

    const cleanPhone = recipientPhone.replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, error: `Invalid phone: "${recipientPhone}"`, timestamp: new Date() };
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;
    try {
      const [onWa] = await this.sock.onWhatsApp(cleanPhone).catch(() => [null]);
      if (onWa && !onWa.exists) {
        return {
          success: false,
          error: `${cleanPhone} is not registered on WhatsApp`,
          timestamp: new Date(),
        };
      }
      const sentMsg = await this.sock.sendMessage(jid, { text: messageText });
      this.lastActiveAt = new Date();
      return { success: true, messageId: sentMsg?.key?.id, timestamp: new Date() };
    } catch (err: any) {
      console.error(`❌ [User ${this.userId}] Send error to ${cleanPhone}:`, err.message);
      return { success: false, error: err.message || "Send failed", timestamp: new Date() };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Multi-User WhatsApp Session Manager
// ─────────────────────────────────────────────────────────────────────────────

class WhatsAppSessionManager {
  private sessions = new Map<string, UserWhatsAppSession>();
  private connectionLocks = new Map<string, Promise<any>>();

  public getSession(userId: string): UserWhatsAppSession {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, new UserWhatsAppSession(userId));
    }
    return this.sessions.get(userId)!;
  }

  /**
   * Connect a user's WhatsApp with a mutex lock — guarantees single socket
   */
  public async connectUser(
    userId: string,
    forceFresh: boolean = false
  ): Promise<{ status: WhatsAppConnectionState; qrCode: string | null }> {
    const existingLock = this.connectionLocks.get(userId);
    if (existingLock) {
      console.log(`🔒 [User ${userId}] Connect already in progress — waiting for existing lock.`);
      return existingLock;
    }

    const connectPromise = (async () => {
      try {
        const session = this.getSession(userId);

        if (session.isConnected() && !forceFresh) {
          const info = await session.getConnectedInfo();
          return { status: info.status, qrCode: null };
        }

        if (forceFresh) {
          // Destroy existing socket and clear credentials folder on disk without DB LOGGED_OUT flicker
          session.destroySocket();
          session.clearTimers();
          try {
            if (fs.existsSync(session.sessionDir)) {
              fs.rmSync(session.sessionDir, { recursive: true, force: true });
            }
          } catch {}
          this.sessions.delete(userId);
          const fresh = this.getSession(userId);
          await fresh.init();
          await new Promise((r) => setTimeout(r, 500));
          const info = await fresh.getConnectedInfo();
          return { status: info.status, qrCode: info.qrCode || null };
        }

        await session.init();

        // Wait up to 8s for QR or connection
        let elapsed = 0;
        while (elapsed < 8_000) {
          const info = await session.getConnectedInfo();
          if (info.status === "CONNECTED" || info.qrCode || info.status === "QR_READY") {
            return { status: info.status, qrCode: info.qrCode || null };
          }
          await new Promise((r) => setTimeout(r, 400));
          elapsed += 400;
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
    this.sessions.delete(userId); // Remove from map — next getSession creates fresh
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
   * Check if a given phone number is already CONNECTED to another user.
   * Used by the worker after a connection event to enforce number uniqueness.
   * Returns the conflicting userId, or null if no conflict.
   */
  public async checkPhoneOwnershipConflict(
    newOwnerUserId: string,
    phone: string
  ): Promise<string | null> {
    try {
      const existing = await prisma.whatsAppSession.findFirst({
        where: {
          connectedPhone: phone,
          status: "CONNECTED",
          userId: { not: newOwnerUserId },
        },
        select: { userId: true },
      });
      return existing?.userId || null;
    } catch {
      return null;
    }
  }

  /**
   * Restore valid sessions on worker startup.
   * Skips: "default" folders, LOGGED_OUT sessions, sessions without saved auth.
   */
  public async restoreAllActiveSessions(): Promise<void> {
    console.log("🔍 [Session Manager] Restoring active sessions from disk...");
    const baseDir = path.join(process.cwd(), "whatsapp_sessions");
    if (!fs.existsSync(baseDir)) return;

    // Get disk folders (each is a userId)
    const userDirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "default")
      .map((d) => d.name);

    // Get DB statuses
    const dbSessions = await prisma.whatsAppSession.findMany({
      where: { userId: { in: userDirs } },
      select: { userId: true, status: true },
    }).catch(() => []);

    const dbStatusMap = new Map(dbSessions.map((s) => [s.userId!, s.status]));

    for (const userId of userDirs) {
      const dbStatus = dbStatusMap.get(userId);

      // Never restore intentionally logged-out sessions
      if (dbStatus === "LOGGED_OUT") {
        console.log(`⏭️ [Session Manager] Skipping ${userId} — LOGGED_OUT.`);
        continue;
      }

      const session = this.getSession(userId);
      if (session.hasSavedAuth()) {
        console.log(`🔄 [Session Manager] Restoring session for user: ${userId} (DB status: ${dbStatus || "unknown"})`);
        session.init().catch((err) => {
          console.warn(`⚠️ [Session Manager] Could not restore ${userId}:`, err.message);
        });
      } else {
        console.log(`⏭️ [Session Manager] Skipping ${userId} — no saved credentials.`);
      }
    }
  }

  public getAllActiveSessions(): Map<string, UserWhatsAppSession> {
    return this.sessions;
  }
}

export const waSessionManager = new WhatsAppSessionManager();
