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
  private presenceInterval: NodeJS.Timeout | null = null;
  private lastSavedDbHash: string = "";

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

  // ── DB sync — ONLY writes to this user's own row, NEVER to "default" ──────

  public async updateDbSession(force: boolean = false): Promise<void> {
    if (!this.userId || this.userId === "default") return;

    // Check if the state really changed to prevent exhausting Supabase connection pool
    const currentHash = `${this.connectionState}|${this.pairingCode || ""}|${this.connectedPhone || ""}|${this.qrCodeDataUrl ? "QR" : ""}|${this.errorMessage || ""}`;
    if (!force && currentHash === this.lastSavedDbHash) {
      return;
    }

    try {
      await prisma.whatsAppSession.upsert({
        where: { userId: this.userId },
        update: {
          tenantId: this.tenantId,
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
          tenantId: this.tenantId,
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
      });
      this.lastSavedDbHash = currentHash;
    } catch (err: any) {
      console.warn(`⚠️ [DB Sync Warning for User ${this.userId}]:`, err.message);
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
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
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

  // ── QR watchdog: if no QR arrives within 60s, reset to NOT_CONNECTED ──────

  private startQrWatchdog() {
    this.clearTimers();
    this.qrWatchdogTimeout = setTimeout(async () => {
      if (this.connectionState === "CONNECTING" || this.connectionState === "INIT_QR") {
        console.warn(`⏱️ [User ${this.userId}] QR watchdog triggered — no QR within 60s. Resetting.`);
        this.destroySocket();
        this.isConnecting = false;
        this.connectionState = "NOT_CONNECTED";
        this.errorMessage = null;
        await this.updateDbSession();
      }
    }, 60_000);
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

    const isPairingMode = this.connectionState === "PAIRING";
    this.isConnecting = true;
    if (!isPairingMode) {
      this.connectionState = "CONNECTING";
    }
    this.errorMessage = null;
    this.userRequestedDisconnect = false;
    await this.updateDbSession();

    // Start QR watchdog only if NOT in pairing mode
    if (!isPairingMode) {
      this.startQrWatchdog();
    }

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
        browser: Browsers.ubuntu("Chrome"),
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 25_000,
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
          this.pairingCode = null;
          this.clearTimers();
          await this.updateDbSession(true);
        }
      });

      // Connection state updates
      this.sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code generated
        if (qr && !state.creds?.registered) {
          // If in PAIRING mode, DO NOT overwrite with QR_READY and DO NOT start 60s destroy timeout!
          if (this.connectionState === "PAIRING") {
            console.log(`📲 [User ${this.userId}] QR emitted by Baileys, but user is in PAIRING mode — keeping PAIRING active.`);
            return;
          }

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
              console.log(`🔄 [User ${this.userId}] QR expired — resetting to NOT_CONNECTED.`);
              this.destroySocket();
              this.isConnecting = false;
              this.connectionState = "NOT_CONNECTED";
              this.qrCodeDataUrl = null;
              this.qrCodeString = null;
              this.qrExpiresAt = null;
              await this.updateDbSession(true);
            }
          }, 62_000);
        }

        // Connection closed
        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          console.log(`⚠️ [User ${this.userId}] Socket closed: code=${statusCode}, msg=${lastDisconnect?.error?.message}`);
          this.clearTimers();
          this.destroySocket();
          this.isConnecting = false;

          // 1. Explicitly logged out from phone
          if (statusCode === DisconnectReason.loggedOut) {
            console.log(`🚫 [User ${this.userId}] Logged out by phone.`);
            await this.logout();
            return;
          }

          // 2. User intentionally clicked Disconnect in UI — do NOT auto-reconnect
          if (this.userRequestedDisconnect) {
            console.log(`🛑 [User ${this.userId}] User-requested disconnect — not reconnecting.`);
            this.connectionState = "DISCONNECTED";
            this.lastDisconnectedAt = new Date();
            await this.updateDbSession(true);
            return;
          }

          // 3. Check if session has saved credentials or was registered
          const isRegistered = !!(state.creds?.registered || state.creds?.me || this.hasSavedAuth());

          // 4. If NOT registered (unauthenticated QR / pairing phase), reset
          if (!isRegistered) {
            console.log(`🔄 [User ${this.userId}] Unauthenticated session closed (code=${statusCode}) — resetting to NOT_CONNECTED.`);
            this.connectionState = "NOT_CONNECTED";
            this.qrCodeString = null;
            this.qrCodeDataUrl = null;
            this.qrExpiresAt = null;
            this.pairingCode = null;
            this.errorMessage = null;
            await this.updateDbSession(true);
            return;
          }

          // 5. REGISTERED SESSION: ALWAYS AUTO-RECONNECT 24/7!
          // Whether restartRequired (515), connectionLost (408), connectionClosed (428), badSession (500), etc.
          this.connectionState = "RECONNECTING";
          this.reconnectAttempts++;
          const backoffMs = Math.min(2_000 * Math.pow(1.3, Math.min(this.reconnectAttempts, 8)), 25_000);
          console.log(`🔄 [User ${this.userId}] Registered session dropped — auto-reconnecting in ${Math.round(backoffMs)}ms (attempt ${this.reconnectAttempts})...`);
          await this.updateDbSession();
          this.reconnectTimeout = setTimeout(() => {
            if (!this.isLoggedOut && !this.userRequestedDisconnect) {
              this.init().catch((err) => {
                console.error(`❌ [User ${this.userId}] Auto-reconnect failed:`, err.message);
              });
            }
          }, backoffMs);
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

          await this.updateDbSession(true);

          // 24/7 Keep-alive presence heartbeat (every 4 minutes)
          this.presenceInterval = setInterval(async () => {
            try {
              if (this.sock && this.connectionState === "CONNECTED") {
                await this.sock.sendPresenceUpdate("available");
              }
            } catch {}
          }, 1000 * 60 * 4);
        }
      });
    } catch (err: any) {
      this.clearTimers();
      this.destroySocket();
      this.isConnecting = false;
      this.connectionState = "ERROR";
      this.errorMessage = err.message || "Failed to initialize WhatsApp socket";
      console.error(`❌ [User ${this.userId}] Init error:`, err.message);
      await this.updateDbSession(true);
    }
  }

  // ── Pairing code ──────────────────────────────────────────────────────────

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    this.isLoggedOut = false;
    this.userRequestedDisconnect = false;

    let cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
      cleanPhone = "92" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
      cleanPhone = "92" + cleanPhone;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error("Invalid phone number. Must include country code (e.g. 923001234567).");
    }

    // Set state to PAIRING before init so that init() and connection.update know we are pairing
    this.connectionState = "PAIRING";
    this.pairingCode = null;
    this.qrCodeDataUrl = null;
    this.qrCodeString = null;
    await this.updateDbSession(true);

    // Destroy any old socket cleanly
    this.destroySocket();
    this.clearTimers();

    await this.init();

    // Wait for socket to be ready
    let tries = 0;
    while (!this.sock && tries < 40) {
      await new Promise((r) => setTimeout(r, 250));
      tries++;
    }
    if (!this.sock) throw new Error("WhatsApp socket initialization timed out.");

    // Wait for WebSocket handshake to settle
    await new Promise((r) => setTimeout(r, 3_000));

    try {
      const code = await this.sock.requestPairingCode(cleanPhone);
      this.pairingCode = code;
      this.connectionState = "PAIRING";
      console.log(`🔑 [User ${this.userId}] Pairing Code generated: ${code}`);
      await this.updateDbSession(true);
      return code;
    } catch (err: any) {
      this.connectionState = "ERROR";
      this.errorMessage = err.message || "Failed to generate pairing code";
      await this.updateDbSession(true);
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

    // Strict Anti-Spam / Anti-Ban Guard: Refuse to send empty messages
    const trimmedText = typeof messageText === "string" ? messageText.trim() : "";
    if (!trimmedText) {
      console.warn(`⚠️ [User ${this.userId}] Refusing to send empty WhatsApp message to ${recipientPhone}`);
      return {
        success: false,
        error: "Message text cannot be empty or blank",
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

      // Human Presence & Typing Simulation (Critical Anti-Ban Safeguard)
      try {
        await this.sock.sendPresenceUpdate("available").catch(() => {});
        await this.sock.sendPresenceUpdate("composing", jid).catch(() => {});
        // Simulate human typing speed (2-5s) based on text length with random jitter
        const typingDelay = Math.min(5000, Math.max(2000, Math.floor(trimmedText.length * 15) + Math.floor(Math.random() * 1500)));
        await new Promise((resolve) => setTimeout(resolve, typingDelay));
        await this.sock.sendPresenceUpdate("paused", jid).catch(() => {});
      } catch {}

      // Wait for confirmation from WhatsApp server with a 15-second strict timeout
      const sendPromise = this.sock.sendMessage(jid, { text: trimmedText });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Send timeout (WhatsApp server unresponsive)")), 15000)
      );
      const sentMsg = await Promise.race([sendPromise, timeoutPromise]) as any;

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
    // If forceFresh, cancel any existing lock — we want a completely clean start
    if (forceFresh) {
      this.connectionLocks.delete(userId);
    }

    const existingLock = this.connectionLocks.get(userId);
    if (existingLock) {
      console.log(`🔒 [User ${userId}] Connect already in progress — waiting for existing lock.`);
      return existingLock;
    }

    const connectPromise = (async () => {
      try {
        if (forceFresh) {
          // Destroy existing socket and clear credentials folder on disk
          const existingSession = this.sessions.get(userId);
          if (existingSession) {
            existingSession.destroySocket();
            existingSession.clearTimers();
          }
          try {
            const sessionDir = path.join(process.cwd(), "whatsapp_sessions", userId);
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
          } catch {}
          // Always remove old session — a fresh one will be created
          this.sessions.delete(userId);
          const fresh = this.getSession(userId);
          await fresh.init();
          await new Promise((r) => setTimeout(r, 800));
          const info = await fresh.getConnectedInfo();
          return { status: info.status, qrCode: info.qrCode || null };
        }

        // Non-forceFresh: reconnect with existing session/credentials
        const session = this.getSession(userId);

        if (session.isConnected()) {
          const info = await session.getConnectedInfo();
          return { status: info.status, qrCode: null };
        }

        // If the session's isLoggedOut flag is set (e.g. from a previous logout), 
        // create a fresh session object — credentials were already wiped.
        if (session.isIntentionallyLoggedOut()) {
          this.sessions.delete(userId);
          const fresh = this.getSession(userId);
          await fresh.init();
          await new Promise((r) => setTimeout(r, 800));
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
    // After disconnect, remove from map so reconnect gets a fresh userRequestedDisconnect=false session
    this.sessions.delete(userId);
  }

  public async logoutUser(userId: string): Promise<void> {
    const session = this.getSession(userId);
    await session.logout();
    // Remove from map AND clear any pending connection locks
    this.sessions.delete(userId);
    this.connectionLocks.delete(userId);
    console.log(`🧹 [Session Manager] Cleaned up session map & locks for user: ${userId}`);
  }

  public async getUserStatus(userId: string): Promise<WhatsAppConnectedInfo> {
    const session = this.getSession(userId);
    return session.getConnectedInfo();
  }

  public async requestPairingCode(userId: string, phone: string): Promise<string> {
    if (this.sessions.has(userId) && this.sessions.get(userId)!.isIntentionallyLoggedOut()) {
      this.sessions.delete(userId);
    }
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

      // Never restore intentionally logged-out or user-disconnected sessions
      if (dbStatus === "LOGGED_OUT" || dbStatus === "DISCONNECTED") {
        console.log(`⏭️ [Session Manager] Skipping inactive user: ${userId}`);
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
