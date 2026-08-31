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
        browser: Browsers.ubuntu("Chrome"),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
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
            }, 5000);
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
          }

          await this.updateDbSession();
        }
      });
    } catch (err: any) {
      this.isConnecting = false;
      this.connectionState = "FAILED";
      this.errorMessage = err.message || "Failed to initialize WhatsApp socket";
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

  isConnected(): boolean {
    return this.connectionState === "CONNECTED" && !!this.sock;
  }

  async forceReconnect(): Promise<void> {
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
      await this.init();
    }

    if (!this.sock) {
      throw new Error("WhatsApp socket could not be initialized");
    }

    // Wait a brief moment if socket is starting up
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const code = await this.sock.requestPairingCode(cleanPhone);
      return code;
    } catch (err: any) {
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
    try {
      await prisma.whatsAppSession.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          status: this.connectionState as any,
          qrCode: this.qrCodeDataUrl,
          connectedPhone: this.connectedPhone,
          connectedName: this.connectedName,
          connectedAt: this.connectedAt,
          lastActiveAt: this.lastActiveAt || new Date(),
          errorMessage: this.errorMessage,
        },
        update: {
          status: this.connectionState as any,
          qrCode: this.qrCodeDataUrl,
          connectedPhone: this.connectedPhone,
          connectedName: this.connectedName,
          connectedAt: this.connectedAt,
          lastActiveAt: this.lastActiveAt || new Date(),
          errorMessage: this.errorMessage,
        },
      });
    } catch (e) {
      // ignore DB sync errors during early initialization
    }
  }
}

// Global singleton for Next.js hot reload safety
const globalForWA = global as unknown as { waWebProvider: WhatsAppWebProvider };
export const waWebProvider = globalForWA.waWebProvider || new WhatsAppWebProvider();
if (process.env.NODE_ENV !== "production") globalForWA.waWebProvider = waWebProvider;

export default waWebProvider;
