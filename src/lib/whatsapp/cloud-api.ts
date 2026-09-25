/**
 * Utility functions for Meta Official WhatsApp Cloud API
 */

export class WhatsAppCloudAPI {
  private static get baseUrl() {
    // Current API version v20.0
    const phoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
    return `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  }

  private static get headers() {
    return {
      'Authorization': `Bearer ${process.env.WHATSAPP_CLOUD_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Send a free-form text message (requires an active 24-hour conversation window)
   * @param to Phone number with country code (e.g. 923001234567)
   * @param text The message text
   */
  public static async sendTextMessage(to: string, text: string) {
    if (!process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || !process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID) {
      throw new Error('WhatsApp Cloud API credentials are not set in .env');
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      }
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Failed to send WhatsApp message:', data);
        throw new Error(data.error?.message || 'Failed to send message');
      }

      console.log(`✅ Message sent successfully to ${to}. Message ID:`, data.messages?.[0]?.id);
      return data;
    } catch (error) {
      console.error('❌ Error sending WhatsApp text message:', error);
      throw error;
    }
  }

  /**
   * Send a template message (required for initiating conversations)
   * @param to Phone number with country code
   * @param templateName Name of the approved template in Meta dashboard
   * @param languageCode e.g., 'en_US'
   * @param components Dynamic components (variables, buttons) if any
   */
  public static async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en_US', 
    components: any[] = []
  ) {
    if (!process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || !process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID) {
      throw new Error('WhatsApp Cloud API credentials are not set in .env');
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components: components
      }
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Failed to send WhatsApp template:', data);
        throw new Error(data.error?.message || 'Failed to send template');
      }

      console.log(`✅ Template sent successfully to ${to}`);
      return data;
    } catch (error) {
      console.error('❌ Error sending WhatsApp template:', error);
      throw error;
    }
  }
}
