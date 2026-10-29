import { IWhatsAppProvider, WhatsAppConnectedInfo, WhatsAppConnectionState, WhatsAppMessagePayload, WhatsAppSendResult } from "./types";

export class WhatsAppCloudProvider implements IWhatsAppProvider {
  name = "WhatsApp Cloud API (Meta Graph API)";
  private phoneNumberId: string;
  private accessToken: string;

  constructor(phoneNumberId?: string, accessToken?: string) {
    this.phoneNumberId = phoneNumberId || process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "";
    this.accessToken = accessToken || process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || "";
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
      let cleanPhone = payload.recipientPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
        cleanPhone = "92" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("3") && cleanPhone.length === 10) {
        cleanPhone = "92" + cleanPhone;
      }

      const trimmedText = typeof payload.messageText === "string" ? payload.messageText.trim() : "";
      if (!trimmedText && !(payload as any).templateName) {
        return {
          success: false,
          error: "Message text cannot be empty",
          timestamp: new Date(),
        };
      }
      
      let reqBody: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
      };

      if ((payload as any).templateName) {
        reqBody.type = "template";
        reqBody.template = {
          name: (payload as any).templateName,
          language: { code: "en_US" },
          components: (payload as any).components || []
        };
      } else {
        reqBody.type = "text";
        reqBody.text = { preview_url: false, body: trimmedText };
      }

      const sendToApi = async (id: string) => {
        const res = await fetch(
          `https://graph.facebook.com/v20.0/${id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(reqBody),
          }
        );
        return await res.json();
      };

      let data = await sendToApi(this.phoneNumberId);
      const fallbackId = process.env.WHATSAPP_CLOUD_FALLBACK_PHONE_NUMBER_ID || "1328348923692461";
      if (data?.error && fallbackId && fallbackId !== this.phoneNumberId) {
        console.warn(`[CloudProvider] Primary phone ${this.phoneNumberId} error: ${data.error.message}. Trying fallback phone ${fallbackId}...`);
        const fallbackData = await sendToApi(fallbackId);
        if (fallbackData?.messages?.[0]?.id) {
          data = fallbackData;
        }
      }

      if (data?.error) {
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
