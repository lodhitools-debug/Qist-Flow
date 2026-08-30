import { IWhatsAppProvider } from "./types";
import { waWebProvider } from "./web-provider";
import { WhatsAppCloudProvider } from "./cloud-provider";
import { RemoteWhatsAppProvider } from "./remote-provider";

export function getWhatsAppProvider(): IWhatsAppProvider {
  const providerType = (process.env.WHATSAPP_PROVIDER_TYPE || "WEB").toUpperCase();

  if (providerType === "CLOUD") {
    return new WhatsAppCloudProvider();
  }

  // If WHATSAPP_SERVICE_URL is set (Vercel serverless connecting to AlwaysData worker)
  if (process.env.WHATSAPP_SERVICE_URL && process.env.WHATSAPP_SERVICE_URL.trim() !== "") {
    return new RemoteWhatsAppProvider();
  }

  // Local / AlwaysData standalone process direct Baileys provider
  return waWebProvider;
}
