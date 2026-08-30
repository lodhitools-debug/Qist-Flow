import {
  IWhatsAppProvider,
  WhatsAppConnectedInfo,
  WhatsAppConnectionState,
  WhatsAppMessagePayload,
  WhatsAppSendResult,
} from "./types";

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

    const res = await fetch(`${this.serviceUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Remote WhatsApp service error (${res.status}): ${errorBody}`);
    }

    return res.json();
  }

  async init(): Promise<void> {
    await this.request("/api/wa/connect", { method: "POST" });
  }

  async getConnectionState(): Promise<WhatsAppConnectionState> {
    const data = await this.request("/api/wa/status");
    return data.status || "DISCONNECTED";
  }

  async getQRCode(): Promise<string | null> {
    const data = await this.request("/api/wa/status");
    return data.qrCode || null;
  }

  async getConnectedInfo(): Promise<WhatsAppConnectedInfo> {
    const data = await this.request("/api/wa/status");
    return {
      status: data.status || "DISCONNECTED",
      phone: data.phone,
      name: data.name,
      connectedAt: data.connectedAt ? new Date(data.connectedAt) : undefined,
      lastActiveAt: data.lastActiveAt ? new Date(data.lastActiveAt) : undefined,
      qrCode: data.qrCode,
      errorMessage: data.errorMessage,
    };
  }

  async disconnect(): Promise<void> {
    await this.request("/api/wa/disconnect", { method: "POST" });
  }

  async reconnect(): Promise<void> {
    await this.request("/api/wa/connect", { method: "POST" });
  }

  async sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    const data = await this.request("/api/wa/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      success: data.success,
      messageId: data.messageId,
      error: data.error,
      timestamp: new Date(),
    };
  }
}
