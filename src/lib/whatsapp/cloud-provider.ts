import { IWhatsAppProvider, WhatsAppConnectedInfo, WhatsAppConnectionState, WhatsAppMessagePayload, WhatsAppSendResult } from "./types";

export class WhatsAppCloudProvider implements IWhatsAppProvider {
  name = "WhatsApp Cloud API (Meta Graph API)";
  private phoneNumberId: string;
  private accessToken: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_ID || "";
    this.accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || "";
  }

  async init(): Promise<void> {
    // Cloud API is stateless HTTP client
  }

  async getConnectionState(): Promise<WhatsAppConnectionState> {
    return this.accessToken && this.phoneNumberId ? "CONNECTED" : "DISCONNECTED";
  }

  async getQRCode(): Promise<string | null> {
    return null; // Cloud API uses token auth, no QR
  }

  async getConnectedInfo(): Promise<WhatsAppConnectedInfo> {
    const isConnected = !!(this.accessToken && this.phoneNumberId);
    return {
      status: isConnected ? "CONNECTED" : "DISCONNECTED",
      phone: process.env.WHATSAPP_CLOUD_PHONE_NUMBER || "Cloud API Business Number",
      name: "Meta WhatsApp Cloud API",
      connectedAt: isConnected ? new Date() : undefined,
    };
  }

  async disconnect(): Promise<void> {
    // Clear tokens
  }

  async reconnect(): Promise<void> {
    // No-op
  }

  async sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    if (!this.accessToken || !this.phoneNumberId) {
      return {
        success: false,
        error: "WhatsApp Cloud API credentials are not configured in .env",
        timestamp: new Date(),
      };
    }

    try {
      const cleanPhone = payload.recipientPhone.replace(/[^0-9]/g, "");
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone,
            type: "text",
            text: { preview_url: false, body: payload.messageText },
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error?.message || "Cloud API Error",
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id || "cloud_msg_" + Date.now(),
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Failed to call WhatsApp Cloud API",
        timestamp: new Date(),
      };
    }
  }
}
