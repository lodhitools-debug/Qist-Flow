import crypto from "node:crypto";
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  (globalThis as any).crypto = (crypto as any).webcrypto || crypto;
}

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
  ConnectionState,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { IWhatsAppProvider, WhatsAppConnectedInfo, WhatsAppConnectionState, WhatsAppMessagePayload, WhatsAppSendResult } from "./types";
import { prisma } from "../prisma";

class WhatsAppWebProvider implements IWhatsAppProvider {
  name = "WhatsApp Web (Baileys)";
  private sock: WASocket | null = null;
  private qrCodeString: string | null = null;
  private qrCodeDataUrl: string | null = null;
  private pairingCode: string | null = null;
  private connectionState: WhatsAppConnectionState = "DISCONNECTED";
  private connectedPhone: string | null = null;
  private connectedName: string | null = null;
  private connectedAt: Date | null = null;
  private lastActiveAt: Date | null = null;
  private errorMessage: string | null = null;
  private isConnecting: boolean = false;
  private sessionDir: string;

  constructor() {
    this.sessionDir = process.env.WHATSAPP_SESSION_PATH || path.join(process.cwd(), "whatsapp_auth");
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  async init(): Promise<void> {
    if (this.isConnecting || this.sock) return;

    try {
      this.isConnecting = true;
      this.connectionState = "CONNECTING";
      this.errorMessage = null;
      await this.updateDbSession();

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
      let version: any = [2, 3000, 1043857760];
      try {
        const vData = await fetchLatestBaileysVersion().catch(() => null);
        if (vData && vData.version) {
          version = vData.version;
        }
      } catch (e) {}

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

      this.sock.ev.on("creds.update", async (creds) => {
        await saveCreds();
        // If registration was completed, extract phone immediately
        if (state.creds?.me?.id && !this.connectedPhone) {
          const rawId = state.creds.me.id;
          this.connectedPhone = rawId ? rawId.split(":")[0].replace(/[^0-9]/g, "") : null;
          this.connectedName = state.creds.me.name || "QistFlow WhatsApp";
          this.connectionState = "CONNECTED";
          this.qrCodeString = null;
          this.qrCodeDataUrl = null;
          await this.updateDbSession();
        }
      });

      this.sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !state.creds?.registered) {
          console.log("\n📲 [Baileys] WhatsApp Pairing QR Code Generated!");
          this.qrCodeString = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
            const terminalQR = await QRCode.toString(qr, { type: "terminal", small: true });
            console.log(terminalQR);
            console.log("👉 Scan this QR code in WhatsApp or open https://qistflow.vercel.app/whatsapp/connection\n");
          } catch (e) {
            console.error("❌ [Baileys] Failed to convert QR to DataURL:", e);
            this.qrCodeDataUrl = null;
          }
          this.connectionState = "QR_READY";
          await this.updateDbSession();
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          const isRegistered = !!(state.creds?.registered || state.creds?.me || this.hasSavedAuth());
          const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

          console.log(`⚠️ [Baileys] Connection closed: statusCode=${statusCode}, shouldReconnect=${shouldReconnect}, isRegistered=${isRegistered}`);

          if (isRegistered || isRestartRequired) {
            // Credentials exist! WhatsApp is finalizing authentication handshake. Reconnect immediately without wiping
            console.log("🔄 [Baileys] Socket restart required to finalize connection. Reconnecting...");
            this.connectionState = "CONNECTING";
            this.sock = null;
            this.isConnecting = false;
            setTimeout(() => {
              this.init();
            }, 1200);
          } else {
            this.connectionState = statusCode === DisconnectReason.loggedOut ? "DISCONNECTED" : "FAILED";
            this.errorMessage = lastDisconnect?.error?.message || "Connection closed";
            this.qrCodeString = null;
            this.qrCodeDataUrl = null;
            this.sock = null;
            this.isConnecting = false;

            await this.updateDbSession();

            if (shouldReconnect) {
              setTimeout(() => {
                this.init();
              }, 3000);
            }
          }
        } else if (connection === "open") {
          this.connectionState = "CONNECTED";
          this.errorMessage = null;
          this.qrCodeString = null;
          this.qrCodeDataUrl = null;
          this.isConnecting = false;
          this.connectedAt = new Date();
          this.lastActiveAt = new Date();

          // Extract phone
          if (this.sock?.user) {
            const rawId = this.sock.user.id;
            this.connectedPhone = rawId ? rawId.split(":")[0].replace(/[^0-9]/g, "") : null;
            this.connectedName = this.sock.user.name || "QistFlow WhatsApp";
            console.log(`\n🎉🎉🎉 [Baileys] WhatsApp Connected Successfully as: ${this.connectedName} (${this.connectedPhone})\n`);
          }

          await this.updateDbSession();
        }
      });
    } catch (err: any) {
      this.isConnecting = false;
      this.connectionState = "FAILED";
      this.errorMessage = err.message || "Failed to initialize WhatsApp socket";
      console.error("❌ [Baileys Init Error]:", err.message);
      await this.updateDbSession();
    }
  }

  async getConnectionState(): Promise<WhatsAppConnectionState> {
    return this.connectionState;
  }

  async getQRCode(): Promise<string | null> {
    return this.qrCodeDataUrl;
  }

  async getConnectedInfo(): Promise<WhatsAppConnectedInfo> {
    // Also try to read from DB if in-memory is cold
    if (this.connectionState === "DISCONNECTED") {
      try {
        const dbSession = await prisma.whatsAppSession.findUnique({ where: { id: "default" } });
        if (dbSession) {
          return {
            status: (dbSession.status as WhatsAppConnectionState) || "DISCONNECTED",
            qrCode: dbSession.qrCode,
            phone: dbSession.connectedPhone || undefined,
            name: dbSession.connectedName || undefined,
            connectedAt: dbSession.connectedAt || undefined,
            lastActiveAt: dbSession.lastActiveAt || undefined,
            errorMessage: dbSession.errorMessage || undefined,
          };
        }
      } catch {}
    }

    return {
      status: this.connectionState,
      qrCode: this.qrCodeDataUrl,
      phone: this.connectedPhone || undefined,
      name: this.connectedName || undefined,
      connectedAt: this.connectedAt || undefined,
      lastActiveAt: this.lastActiveAt || undefined,
      errorMessage: this.errorMessage || undefined,
    };
  }

  async disconnect(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout("User requested disconnect");
        this.sock = null;
      }
    } catch (e) {
      // ignore
    }

    this.connectionState = "DISCONNECTED";
    this.qrCodeString = null;
    this.qrCodeDataUrl = null;
    this.connectedPhone = null;
    this.connectedName = null;
    this.isConnecting = false;

    // Remove auth folder files safely
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
        fs.mkdirSync(this.sessionDir, { recursive: true });
      }
    } catch (e) {}

    await this.updateDbSession();
  }

  hasSavedAuth(): boolean {
    try {
      const credsPath = path.join(this.sessionDir, "creds.json");
      if (fs.existsSync(credsPath)) {
        const content = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
        return !!(content?.me || content?.registered || content?.account);
      }
    } catch {}
    return false;
  }

  isConnected(): boolean {
    return this.connectionState === "CONNECTED" && !!this.sock;
  }

  async forceReconnect(clearAuth: boolean = false): Promise<void> {
    try {
      if (this.sock) {
        this.sock.ev.removeAllListeners("connection.update");
        this.sock.ev.removeAllListeners("creds.update");
        this.sock.end(undefined);
        this.sock = null;
      }
      this.isConnecting = false;
      this.qrCodeString = null;
      this.qrCodeDataUrl = null;
      this.connectionState = "CONNECTING";

      if (clearAuth && fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
        fs.mkdirSync(this.sessionDir, { recursive: true });
      }
    } catch {}
    await this.init();
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.init();
  }

  async requestPairingCode(phone: string): Promise<string> {
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
      cleanPhone = "92" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
      cleanPhone = "92" + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error("Please enter a valid WhatsApp phone number (e.g. 03001234567 or 923001234567)");
    }

    if (!this.sock) {
      this.isConnecting = false;
      await this.init();
    }

    for (let i = 0; i < 40 && !this.sock; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (!this.sock) {
      throw new Error("WhatsApp socket initialization timed out. Please try again.");
    }

    // Wait a brief moment for socket handshaking
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const rawCode = await this.sock.requestPairingCode(cleanPhone);
      const code = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode;
      this.pairingCode = code;
      console.log(`\n========================================`);
      console.log(`🔑 WhatsApp 8-Digit Pairing Code: ${code}`);
      console.log(`📱 Enter this code on phone: ${cleanPhone}`);
      console.log(`========================================\n`);
      return code;
    } catch (err: any) {
      console.error("Pairing code error details:", err);
      throw new Error(err.message || "Failed to request pairing code from WhatsApp");
    }
  }

  async sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    if (!this.sock || this.connectionState !== "CONNECTED") {
      return {
        success: false,
        error: "WhatsApp is not connected. Please link your WhatsApp device first.",
        timestamp: new Date(),
      };
    }

    try {
      let cleanPhone = payload.recipientPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
        cleanPhone = "92" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
        cleanPhone = "92" + cleanPhone;
      }
      const jid = `${cleanPhone}@s.whatsapp.net`;

      const result = await this.sock.sendMessage(jid, {
        text: payload.messageText,
      });

      this.lastActiveAt = new Date();
      await this.updateDbSession();

      return {
        success: true,
        messageId: result?.key?.id || "wa_msg_" + Date.now(),
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Failed to deliver WhatsApp message",
        timestamp: new Date(),
      };
    }
  }

  private async updateDbSession(): Promise<void> {
    // NOTE: This legacy provider's DB sync is disabled.
    // Session state is now fully managed by UserWhatsAppSession / WhatsAppSessionManager.
    // The web-provider singleton is retained for backwards-compatible imports only.
    console.log(`📡 [Legacy web-provider] status=${this.connectionState}, phone=${this.connectedPhone || "none"}`);
  }
}

// Global singleton for Next.js hot reload safety
const globalForWA = global as unknown as { waWebProvider: WhatsAppWebProvider };
export const waWebProvider = globalForWA.waWebProvider || new WhatsAppWebProvider();
if (process.env.NODE_ENV !== "production") globalForWA.waWebProvider = waWebProvider;

export default waWebProvider;
