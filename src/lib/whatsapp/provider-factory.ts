import { IWhatsAppProvider } from "./types";
import { RemoteWhatsAppProvider } from "./remote-provider";

export function getWhatsAppProvider(): IWhatsAppProvider {
  const providerType = (process.env.WHATSAPP_PROVIDER_TYPE || "WEB").toUpperCase();

  if (providerType === "CLOUD") {
    const { WhatsAppCloudProvider } = require("./cloud-provider");
    return new WhatsAppCloudProvider();
  }

  // If this process is the background worker daemon (AlwaysData / local standalone worker)
  if (process.env.IS_WORKER === "true" || process.env.RUN_AS_WORKER === "true") {
    const { waWebProvider } = require("./web-provider");
    return waWebProvider;
  }

  // In Next.js Serverless runtime (Vercel), always use RemoteWhatsAppProvider
  return new RemoteWhatsAppProvider();
}
