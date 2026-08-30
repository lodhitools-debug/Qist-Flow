import {
  IWhatsAppProvider,
  WhatsAppConnectedInfo,
  WhatsAppConnectionState,
  WhatsAppMessagePayload,
  WhatsAppSendResult,
} from "./types";
import { prisma } from "../prisma";

/**
 * RemoteWhatsAppProvider connects Vercel serverless application
 * to the long-lived Baileys WhatsApp worker hosted on AlwaysData.
 */
export class RemoteWhatsAppProvider implements IWhatsAppProvider {
  public name = "Remote (AlwaysData Baileys Worker)";
  private serviceUrl: string;
  private secret: string;

  constructor() {
    this.serviceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");
    this.secret = process.env.WHATSAPP_SERVICE_SECRET || "";
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.serviceUrl) {
      throw new Error("WHATSAPP_SERVICE_URL is not configured.");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-whatsapp-secret": this.secret,
      ...(options.headers as Record<string, string>),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    try {
      const res = await fetch(`${this.serviceUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        if (contentType.includes("application/json")) {
          const errData = await res.json();
          errorMsg = errData.error || errData.message || errorMsg;
        } else {
          const rawText = await res.text();
          errorMsg = rawText.length > 200 ? `Status ${res.status} returned non-JSON response` : rawText;
        }
        throw new Error(`AlwaysData Worker error: ${errorMsg}`);
      }

      if (contentType.includes("application/json")) {
        return await res.json();
      }

      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`AlwaysData Worker returned non-JSON response: ${text.slice(0, 100)}`);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error("Connection to AlwaysData WhatsApp Worker timed out.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async init(): Promise<void> {
    try {
      await this.request("/api/wa/connect", { method: "POST" });
    } catch (err: any) {
      // Fallback: update DB session state to CONNECTING so UI knows it's pending
      await prisma.whatsAppSession.upsert({
        where: { id: "default" },
        update: {
          status: "CONNECTING",
          errorMessage: err.message,
          updatedAt: new Date(),
        },
        create: {
          id: "default",
          status: "CONNECTING",
          errorMessage: err.message,
        },
      }).catch(() => {});
      throw err;
    }
  }

  async getConnectionState(): Promise<WhatsAppConnectionState> {
    try {
      const data = await this.request("/api/wa/status");
      return data.status || "DISCONNECTED";
    } catch {
      // Database fallback
      const dbSession = await prisma.whatsAppSession.findUnique({ where: { id: "default" } }).catch(() => null);
      return (dbSession?.status as WhatsAppConnectionState) || "DISCONNECTED";
    }
  }

  async getQRCode(): Promise<string | null> {
    try {
      const data = await this.request("/api/wa/status");
      return data.qrCode || null;
    } catch {
      const dbSession = await prisma.whatsAppSession.findUnique({ where: { id: "default" } }).catch(() => null);
      return dbSession?.qrCode || null;
    }
  }

  async getConnectedInfo(): Promise<WhatsAppConnectedInfo> {
    try {
      const data = await this.request("/api/wa/status");
      return {
        status: data.status || "DISCONNECTED",
        phone: data.phone || data.connectedPhone,
        name: data.name || data.connectedName,
        connectedAt: data.connectedAt ? new Date(data.connectedAt) : undefined,
        lastActiveAt: data.lastActiveAt ? new Date(data.lastActiveAt) : undefined,
        qrCode: data.qrCode,
        errorMessage: data.errorMessage,
      };
    } catch (err: any) {
      // Safe fallback to Supabase PostgreSQL database session
      const dbSession = await prisma.whatsAppSession.findUnique({ where: { id: "default" } }).catch(() => null);
      return {
        status: (dbSession?.status as WhatsAppConnectionState) || "DISCONNECTED",
        phone: dbSession?.connectedPhone || undefined,
        name: dbSession?.connectedName || undefined,
        connectedAt: dbSession?.connectedAt || undefined,
        lastActiveAt: dbSession?.lastActiveAt || undefined,
        qrCode: dbSession?.qrCode || null,
        errorMessage: dbSession?.errorMessage || (this.serviceUrl ? err.message : "WhatsApp Worker service URL not configured"),
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.request("/api/wa/disconnect", { method: "POST" });
    } catch {
      // Update DB session to DISCONNECTED
      await prisma.whatsAppSession.upsert({
        where: { id: "default" },
        update: { status: "DISCONNECTED", qrCode: null, updatedAt: new Date() },
        create: { id: "default", status: "DISCONNECTED" },
      }).catch(() => {});
    }
  }

  async reconnect(): Promise<void> {
    await this.init();
  }

  async sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    const data = await this.request("/api/wa/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      success: !!data.success,
      messageId: data.messageId,
      error: data.error,
      timestamp: new Date(),
    };
  }
}
